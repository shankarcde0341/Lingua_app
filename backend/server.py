import os
import uuid
import logging
import httpx
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, APIRouter, Header, HTTPException, Request, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionRequest,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------- Env & clients ----------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "lingua_franca")
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")
# ZEGOCLOUD Voice SDK credentials (read-only wiring; consumed by future
# token-generation endpoint, no runtime effect until then).
ZEGO_APP_ID = os.environ.get("ZEGO_APP_ID", "")
ZEGO_SERVER_SECRET = os.environ.get("ZEGO_SERVER_SECRET", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Lingua Franca API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("lingua-franca")

EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

# ---------- Models ----------
class SessionCreate(BaseModel):
    session_id: str

class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    english_level: str = "Beginner"
    xp: int = 0
    streak: int = 0
    last_active_date: Optional[str] = None
    daily_goal_minutes: int = 15
    daily_goal_completed_minutes: int = 0
    is_premium: bool = False
    premium_plan: Optional[str] = None
    premium_until: Optional[str] = None
    saved_words: List[str] = []
    friends: List[str] = []
    blocked: List[str] = []
    achievements: List[str] = []
    certificates: List[Dict[str, Any]] = []
    phone: Optional[str] = None
    referral_code: Optional[str] = None
    referred_by: Optional[str] = None
    referral_count: int = 0
    referral_discount_active: bool = False

class UpdateProfile(BaseModel):
    name: Optional[str] = None
    english_level: Optional[str] = None
    daily_goal_minutes: Optional[int] = None
    picture: Optional[str] = None
    phone: Optional[str] = None

class XPEvent(BaseModel):
    amount: int
    reason: str
    minutes: Optional[int] = 0

class SpeakingTestResult(BaseModel):
    level: str  # beginner / intermediate / advanced
    fluency: int
    pronunciation: int
    grammar: int
    vocabulary: int
    overall: int

class LessonProgressUpdate(BaseModel):
    lesson_id: str
    completed: bool = True

class VocabAction(BaseModel):
    word_id: str

class CallLogCreate(BaseModel):
    partner_name: str
    partner_avatar: str
    duration_seconds: int
    partner_gender: str = "any"

class FriendRequestCreate(BaseModel):
    to_name: str
    to_avatar: str

class ReportCreate(BaseModel):
    target_name: str
    reason: str

class RoomCreate(BaseModel):
    title: str
    topic: str
    is_private: bool = False

class RoomJoin(BaseModel):
    room_id: str

class CheckoutRequest(BaseModel):
    plan: str  # weekly | monthly | quarterly | yearly
    origin_url: str

class PhoneSendOtp(BaseModel):
    phone: str

class PhoneVerifyOtp(BaseModel):
    phone: str
    code: str
    name: Optional[str] = None
    referral_code: Optional[str] = None

class LinkPhone(BaseModel):
    phone: str
    code: str

class ApplyReferral(BaseModel):
    referral_code: str

class ZegoTokenRequest(BaseModel):
    room_id: str

# ---------- Auth helpers ----------
async def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires = session.get("expires_at")
    if expires and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires and expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def _user_to_out(u: Dict[str, Any]) -> UserOut:
    return UserOut(
        user_id=u["user_id"],
        email=u["email"],
        name=u.get("name", ""),
        picture=u.get("picture"),
        english_level=u.get("english_level", "Beginner"),
        xp=u.get("xp", 0),
        streak=u.get("streak", 0),
        last_active_date=u.get("last_active_date"),
        daily_goal_minutes=u.get("daily_goal_minutes", 15),
        daily_goal_completed_minutes=u.get("daily_goal_completed_minutes", 0),
        is_premium=u.get("is_premium", False),
        premium_plan=u.get("premium_plan"),
        premium_until=u.get("premium_until"),
        saved_words=u.get("saved_words", []),
        friends=u.get("friends", []),
        blocked=u.get("blocked", []),
        achievements=u.get("achievements", []),
        certificates=u.get("certificates", []),
        phone=u.get("phone"),
        referral_code=u.get("referral_code"),
        referred_by=u.get("referred_by"),
        referral_count=u.get("referral_count", 0),
        referral_discount_active=u.get("referral_discount_active", False),
    )

def _gen_referral_code(name: str) -> str:
    import random
    import string
    prefix = "".join(c for c in (name or "USER").upper() if c.isalpha())[:4] or "USER"
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"{prefix}-{suffix}"

async def _unique_referral_code(name: str) -> str:
    for _ in range(6):
        code = _gen_referral_code(name)
        exists = await db.users.find_one({"referral_code": code}, {"_id": 1})
        if not exists:
            return code
    return f"USER-{uuid.uuid4().hex[:6].upper()}"

# ---------- Static content seed ----------
LESSON_CATEGORIES = [
    {"id": "daily", "name": "Daily English", "color": "#3B82F6", "icon": "chatbubbles"},
    {"id": "business", "name": "Business English", "color": "#0EA5E9", "icon": "briefcase"},
    {"id": "interview", "name": "Interview English", "color": "#6366F1", "icon": "person"},
    {"id": "travel", "name": "Travel English", "color": "#14B8A6", "icon": "airplane"},
]

def _lesson(cat, i, title, desc, level, minutes, script=None):
    return {
        "id": f"{cat}-{i}",
        "category_id": cat,
        "title": title,
        "description": desc,
        "level": level,
        "duration_minutes": minutes,
        "xp_reward": 25 + (i * 5),
        "content": [
            {"type": "intro", "text": desc},
            {"type": "phrase", "text": f"Practice sentence {i}.1 for {title}."},
            {"type": "phrase", "text": f"Practice sentence {i}.2 for {title}."},
            {"type": "tip", "text": f"Tip: focus on stress and intonation while practicing {title}."},
        ],
        "script": script or [],
    }
    
    return {
        "id": f"{cat}-{i}",
        "category_id": cat,
        "title": title,
        "description": desc,
        "level": level,
        "duration_minutes": minutes,
        "xp_reward": 25 + (i * 5),
        "content": [
            {"type": "intro", "text": desc},
            {"type": "phrase", "text": f"Practice sentence {i}.1 for {title}."},
            {"type": "phrase", "text": f"Practice sentence {i}.2 for {title}."},
            {"type": "tip", "text": f"Tip: focus on stress and intonation while practicing {title}."},
        ],
        "script": script or [],
    }

PILOT_LESSON_SCRIPTS = {
    "daily-1": [
        {"line_id": "daily-1-l1", "speaker": "A", "text": "Hi, I'm Alex. What's your name?", "audio_url": "app/frontend/assets/audio/daily_1/alex-lesson-1-intro_L1.mp3"},
        {"line_id": "daily-1-l2", "speaker": "B", "text": "Hi Alex, I'm Jordan. Nice to meet you.", "audio_url": "/static/audio/daily-1/daily-1-l2.mp3"},
        {"line_id": "daily-1-l3", "speaker": "A", "text": "Where are you from?", "audio_url": "/static/audio/daily-1/daily-1-l3.mp3"},
        {"line_id": "daily-1-l4", "speaker": "B", "text": "I'm from Mexico, and I love learning English.", "audio_url": "/static/audio/daily-1/daily-1-l4.mp3"},
    ],
    "business-1": [
        {"line_id": "business-1-l1", "speaker": "A", "text": "Good morning, everyone. Let's start the meeting.", "audio_url": "/static/audio/business-1/business-1-l1.mp3"},
        {"line_id": "business-1-l2", "speaker": "B", "text": "Good morning. The quarterly report is ready.", "audio_url": "/static/audio/business-1/business-1-l2.mp3"},
        {"line_id": "business-1-l3", "speaker": "A", "text": "Please share your insights on the sales figures.", "audio_url": "/static/audio/business-1/business-1-l3.mp3"},
        {"line_id": "business-1-l4", "speaker": "B", "text": "We saw strong growth in our new product line.", "audio_url": "/static/audio/business-1/business-1-l4.mp3"},
    ],
    "interview-1": [
        {"line_id": "interview-1-l1", "speaker": "A", "text": "Tell me about yourself in a few sentences.", "audio_url": "/static/audio/interview-1/interview-1-l1.mp3"},
        {"line_id": "interview-1-l2", "speaker": "B", "text": "I'm a product manager with five years of experience.", "audio_url": "/static/audio/interview-1/interview-1-l2.mp3"},
        {"line_id": "interview-1-l3", "speaker": "A", "text": "What motivates you to join our team?", "audio_url": "/static/audio/interview-1/interview-1-l3.mp3"},
        {"line_id": "interview-1-l4", "speaker": "B", "text": "I enjoy building user-focused products and solving problems.", "audio_url": "/static/audio/interview-1/interview-1-l4.mp3"},
    ],
    "travel-1": [
        {"line_id": "travel-1-l1", "speaker": "A", "text": "Welcome to the airport. Do you have your passport?", "audio_url": "/static/audio/travel-1/travel-1-l1.mp3"},
        {"line_id": "travel-1-l2", "speaker": "B", "text": "Yes, here it is. I'm flying to Madrid.", "audio_url": "/static/audio/travel-1/travel-1-l2.mp3"},
        {"line_id": "travel-1-l3", "speaker": "A", "text": "Are you checking in any luggage today?", "audio_url": "/static/audio/travel-1/travel-1-l3.mp3"},
        {"line_id": "travel-1-l4", "speaker": "B", "text": "Just one suitcase and my carry-on bag.", "audio_url": "/static/audio/travel-1/travel-1-l4.mp3"},
    ],
}

DAILY_1_SCRIPT = [
    {"line_id": "d1-l1", "speaker": "Alex", "text": "Hello Good morning!", "app/frontend/assets/audio/intro/alex_L1.mp3": "alex_L1.mp3"},
    {"line_id": "d1-l2", "speaker": "Priya", "text": "Good morning, My name is Priya. What is your name?", "app/frontend/assets/audio/intro/priya_L1.mp3": "priya_L1.mp3"},
    {"line_id": "d1-l3", "speaker": "Alex", "text": "I am Alex. Nice to meet you, Priya.", "app/frontend/assets/audio/intro/alex_L2.mp3": "alex_L2.mp3"},
    {"line_id": "d1-l4", "speaker": "Priya", "text": "Nice to meet you too, Alex. Where are you from?.", "app/frontend/assets/audio/intro/priya_L2.mp3": "priya_L2.mp3"},
    {"line_id": "d1-l5", "speaker": "Alex", "text": "I am from Delhi. And you?", "app/frontend/assets/audio/intro/alex_L3.mp3": "alex_L3.mp3"},
    {"line_id": "d1-l6", "speaker": "Priya", "text": "I am from Mumbai. What do you do?", "app/frontend/assets/audio/intro/priya_L3.mp3": "priya_L3.mp3"},
    {"line_id": "d1-l7", "speaker": "Alex", "text": "I am a student. What about you?", "app/frontend/assets/audio/intro/alex_L4.mp3": "alex_L4.mp3"},
    {"line_id": "d1-l8", "speaker": "Priya", "text": "I work in an office. What are your hobbies?", "app/frontend/assets/audio/intro/priya_L4.mp3": "priya_L4.mp3"},
    {"line_id": "d1-l9", "speaker": "Alex", "text": "I like playing cricket and reading books.", "app/frontend/assets/audio/intro/alex_L5.mp3": "alex_L5.mp3"},
]

LESSONS = [
    _lesson("daily", 1, "Introducing Yourself", "Learn to greet and share basic info.", "Beginner", 8, script=DAILY_1_SCRIPT),
    _lesson("daily", 2, "Ordering at a Cafe", "Common phrases at a coffee shop.", "Beginner", 10),
    _lesson("daily", 3, "Making Small Talk", "Casual conversations with strangers.", "Intermediate", 12),
    _lesson("daily", 4, "Shopping & Asking Prices", "Bargain, compare and pay confidently.", "Beginner", 9),
    _lesson("daily", 5, "Giving & Following Directions", "Navigate a city like a local.", "Beginner", 10),
    _lesson("daily", 6, "At the Restaurant", "Order, request and pay in style.", "Beginner", 11),
    _lesson("daily", 7, "Talking About Weekends", "Share plans and past events smoothly.", "Intermediate", 12),
    _lesson("daily", 8, "Doctor & Pharmacy Visit", "Explain symptoms and understand advice.", "Intermediate", 13),
    _lesson("daily", 9, "Phone Conversations", "Sound natural and clear on calls.", "Intermediate", 12),
    _lesson("daily", 10, "Expressing Opinions", "Agree, disagree and add nuance.", "Advanced", 14),
    _lesson("daily", 11, "Making Complaints", "Express dissatisfaction politely and constructively.", "Intermediate", 11),
    _lesson("daily", 12, "Asking for Help & Favors", "Request assistance naturally and courteously.", "Beginner", 10),
    _lesson("daily", 13, "Congratulating & Celebrating", "Respond genuinely to good news and achievements.", "Intermediate", 10),
    _lesson("daily", 14, "Dealing with Misunderstandings", "Clarify, rephrase and resolve communication gaps.", "Intermediate", 13),
    _lesson("daily", 15, "Apologizing & Making Amends", "Express genuine apologies and repair relationships.", "Beginner", 11),
    _lesson("daily", 16, "Job & Career Conversations", "Discuss work, ambitions and professional growth.", "Intermediate", 12),
    _lesson("daily", 17, "Hobbies & Interests", "Talk passionately about what you love doing.", "Intermediate", 11),
    _lesson("daily", 18, "Travel & Vacation Stories", "Share travel experiences and ask about trips.", "Beginner", 10),
    _lesson("daily", 19, "Family & Relationships", "Discuss family, friends and personal connections.", "Intermediate", 12),
    _lesson("daily", 20, "Weather & Casual Chitchat", "Master small talk and everyday conversation starters.", "Beginner", 9),
    _lesson("business", 1, "Business Meetings", "Language for productive meetings.", "Intermediate", 15),
    _lesson("business", 2, "Writing Professional Emails", "Structure and tone for emails.", "Intermediate", 10),
    _lesson("business", 3, "Negotiating Deals", "Persuasive language for negotiations.", "Advanced", 18),
    _lesson("business", 4, "Presenting with Confidence", "Deliver impactful presentations and pitches.", "Advanced", 16),
    _lesson("business", 5, "Networking & Building Relationships", "Make meaningful professional connections.", "Intermediate", 14),
    _lesson("business", 6, "Handling Difficult Conversations", "Address conflicts and feedback diplomatically.", "Advanced", 15),
    _lesson("business", 7, "Corporate Culture & Etiquette", "Navigate workplace norms and professional behavior.", "Intermediate", 12),
    _lesson("business", 8, "Remote Work Communication", "Excel in video calls and virtual collaboration.", "Intermediate", 13),
    _lesson("business", 9, "Sales & Persuasion Techniques", "Influence and close deals with confidence.", "Advanced", 17),
    _lesson("business", 10, "Leadership & Team Motivation", "Inspire and manage teams effectively.", "Advanced", 16),
    _lesson("business", 11, "Project Management Communication", "Coordinate teams and manage timelines effectively.", "Intermediate", 14),
    _lesson("business", 12, "Client Relations & Account Management", "Build and maintain strong client relationships.", "Intermediate", 13),
    _lesson("business", 13, "Budget & Financial Discussions", "Discuss finances and ROI confidently.", "Advanced", 15),
    _lesson("business", 14, "Cross-Cultural Business Communication", "Navigate differences in international business.", "Advanced", 16),
    _lesson("business", 15, "Change Management & Organizational Updates", "Communicate changes and transitions smoothly.", "Intermediate", 14),
    _lesson("business", 16, "Conflict Resolution in Workplace", "Mediate disputes and find win-win solutions.", "Advanced", 15),
    _lesson("business", 17, "Innovation & Strategic Planning Discussions", "Present ideas and align teams on strategy.", "Advanced", 17),
    _lesson("business", 18, "Employee Performance Reviews", "Conduct and receive feedback professionally.", "Intermediate", 13),
    _lesson("business", 19, "Mentoring & Coaching Conversations", "Guide and develop team members effectively.", "Intermediate", 14),
    _lesson("business", 20, "Crisis Communication & Problem-Solving", "Handle urgent situations with poise and clarity.", "Advanced", 16),
    _lesson("interview", 1, "Tell Me About Yourself", "Craft a compelling elevator pitch.", "Intermediate", 10),
    _lesson("interview", 2, "Behavioral Questions", "STAR method for tough questions.", "Advanced", 15),
    _lesson("interview", 3, "Why Do You Want This Job?", "Articulate your motivation and fit.", "Intermediate", 12),
    _lesson("interview", 4, "Discussing Your Strengths", "Highlight skills without sounding arrogant.", "Intermediate", 11),
    _lesson("interview", 5, "Addressing Your Weaknesses", "Turn weaknesses into growth opportunities.", "Advanced", 14),
    _lesson("interview", 6, "Technical Questions & Problem-Solving", "Explain technical concepts clearly.", "Advanced", 16),
    _lesson("interview", 7, "Salary Negotiation Conversations", "Discuss compensation confidently.", "Advanced", 13),
    _lesson("interview", 8, "Questions to Ask the Interviewer", "Show genuine interest and strategic thinking.", "Intermediate", 12),
    _lesson("interview", 9, "Handling Difficult Interview Scenarios", "Respond tactfully to tricky situations.", "Advanced", 15),
    _lesson("interview", 10, "Follow-Up & Closing Strong", "Leave a lasting positive impression.", "Intermediate", 10),
    _lesson("interview", 11, "Video Interview Etiquette", "Master camera presence and virtual professionalism.", "Intermediate", 12),
    _lesson("interview", 12, "Panel Interview Strategies", "Engage multiple interviewers effectively.", "Advanced", 14),
    _lesson("interview", 13, "Case Study & Problem-Solving Interviews", "Approach case studies with structured thinking.", "Advanced", 16),
    _lesson("interview", 14, "Group Interview Dynamics", "Stand out while collaborating with other candidates.", "Intermediate", 13),
    _lesson("interview", 15, "Phone & Screening Call Tips", "Excel at initial phone screening rounds.", "Intermediate", 10),
    _lesson("interview", 16, "Industry-Specific Interview Prep", "Prepare for specialized role conversations.", "Advanced", 15),
    _lesson("interview", 17, "Startup vs. Corporate Interview Differences", "Adapt approach based on company culture.", "Intermediate", 13),
    _lesson("interview", 18, "Talking About Your Achievements", "Quantify success and highlight impact.", "Intermediate", 12),
    _lesson("interview", 19, "Cultural Fit & Team Chemistry Questions", "Show alignment with company values.", "Intermediate", 11),
    _lesson("interview", 20, "Negotiating Offer & Next Steps", "Navigate final conversations confidently.", "Advanced", 14),
    _lesson("travel", 1, "At the Airport", "Navigating airports confidently.", "Beginner", 8),
    _lesson("travel", 2, "Booking a Hotel", "Reservations and check-in phrases.", "Beginner", 10),
    _lesson("travel", 3, "Ordering at Restaurants", "Navigate menus and place orders smoothly.", "Beginner", 11),
    _lesson("travel", 4, "Using Public Transportation", "Navigate buses, trains and taxis like a local.", "Beginner", 10),
    _lesson("travel", 5, "Asking for Directions & Maps", "Find your way confidently in unfamiliar places.", "Beginner", 9),
    _lesson("travel", 6, "Shopping & Markets Haggling", "Negotiate prices and shop at local markets.", "Intermediate", 12),
    _lesson("travel", 7, "Emergency Situations & Seeking Help", "Handle medical, police and urgent situations.", "Intermediate", 13),
    _lesson("travel", 8, "Cultural Etiquette & Customs", "Navigate cultural differences respectfully.", "Intermediate", 11),
    _lesson("travel", 9, "Travel Planning & Itineraries", "Discuss plans and make travel reservations.", "Intermediate", 12),
    _lesson("travel", 10, "Dealing with Travel Problems", "Handle delays, lost luggage and complaints.", "Intermediate", 14),
    _lesson("travel", 11, "Accommodation Negotiations", "Discuss amenities, rates, and special requests.", "Intermediate", 11),
    _lesson("travel", 12, "Food & Dietary Preferences", "Navigate dining options and dietary restrictions.", "Beginner", 10),
    _lesson("travel", 13, "Money Exchange & Payment Methods", "Discuss currency and payment options confidently.", "Intermediate", 10),
    _lesson("travel", 14, "Sightseeing & Tourist Attractions", "Ask for recommendations and discuss attractions.", "Beginner", 9),
    _lesson("travel", 15, "Guided Tours & Experiences", "Communicate with tour guides and activity organizers.", "Intermediate", 12),
    _lesson("travel", 16, "Travel Insurance & Documentation", "Discuss policies, visas, and travel documents.", "Intermediate", 11),
    _lesson("travel", 17, "Meeting Locals & Making Friends", "Build genuine connections with local people.", "Intermediate", 13),
    _lesson("travel", 18, "Adventure Sports & Activities", "Discuss thrilling experiences and safety concerns.", "Intermediate", 12),
    _lesson("travel", 19, "Travel Scams & Safety Tips", "Recognize risks and protect yourself confidently.", "Intermediate", 13),
    _lesson("travel", 20, "Travel Stories & Cultural Exchange", "Share experiences and learn about different cultures.", "Intermediate", 14),
]

VOCAB_WORDS = [
    {"id": "w1", "word": "Serendipity", "phonetic": "/ˌser.ənˈdɪp.ə.ti/", "meaning": "Finding something good without looking for it.", "example": "Meeting you here is pure serendipity.", "level": "Advanced"},
    {"id": "w2", "word": "Eloquent", "phonetic": "/ˈel.ə.kwənt/", "meaning": "Fluent and persuasive in speaking.", "example": "She gave an eloquent speech at the conference.", "level": "Intermediate"},
    {"id": "w3", "word": "Resilient", "phonetic": "/rɪˈzɪl.i.ənt/", "meaning": "Able to recover quickly from difficulties.", "example": "Children are surprisingly resilient.", "level": "Intermediate"},
    {"id": "w4", "word": "Meticulous", "phonetic": "/məˈtɪk.jə.ləs/", "meaning": "Showing great attention to detail.", "example": "He is meticulous about his research.", "level": "Advanced"},
    {"id": "w5", "word": "Vivid", "phonetic": "/ˈvɪv.ɪd/", "meaning": "Producing powerful, clear images in the mind.", "example": "She has a vivid imagination.", "level": "Intermediate"},
    {"id": "w6", "word": "Candid", "phonetic": "/ˈkæn.dɪd/", "meaning": "Truthful and straightforward.", "example": "I appreciate your candid feedback.", "level": "Intermediate"},
    {"id": "w7", "word": "Diligent", "phonetic": "/ˈdɪl.ɪ.dʒənt/", "meaning": "Showing care and effort in work.", "example": "She's a diligent student.", "level": "Beginner"},
    {"id": "w8", "word": "Ephemeral", "phonetic": "/ɪˈfem.ər.əl/", "meaning": "Lasting for a very short time.", "example": "The beauty of the sunset was ephemeral.", "level": "Advanced"},
    {"id": "w9", "word": "Empathy", "phonetic": "/ˈem.pə.θi/", "meaning": "Understanding others' feelings.", "example": "Empathy is key to good leadership.", "level": "Intermediate"},
    {"id": "w10", "word": "Nuance", "phonetic": "/ˈnuː.ɑːns/", "meaning": "A subtle difference in meaning.", "example": "Her writing captures every nuance.", "level": "Advanced"},
    {"id": "w11", "word": "Ubiquitous", "phonetic": "/juːˈbɪk.wə.təs/", "meaning": "Present everywhere.", "example": "Smartphones are ubiquitous today.", "level": "Advanced"},
    {"id": "w12", "word": "Gregarious", "phonetic": "/ɡrɪˈɡer.i.əs/", "meaning": "Enjoying the company of others.", "example": "He's a gregarious host.", "level": "Advanced"},
    {"id": "w13", "word": "Pragmatic", "phonetic": "/præɡˈmæt.ɪk/", "meaning": "Dealing with things in a practical, realistic way.", "example": "We need a pragmatic approach to this problem.", "level": "Intermediate"},
    {"id": "w14", "word": "Benevolent", "phonetic": "/bəˈnev.ə.lənt/", "meaning": "Showing kindness and generosity.", "example": "She has a benevolent attitude towards the poor.", "level": "Advanced"},
    {"id": "w15", "word": "Melancholy", "phonetic": "/ˈmel.ən.kol.i/", "meaning": "A feeling of pensive sadness.", "example": "The rainy weather put me in a melancholy mood.", "level": "Intermediate"},
    {"id": "w16", "word": "Audacious", "phonetic": "/ɔːˈdeɪ.ʃəs/", "meaning": "Brave and daring; willing to take risks.", "example": "His audacious plan surprised everyone.", "level": "Advanced"},
    {"id": "w17", "word": "Placid", "phonetic": "/ˈplæs.ɪd/", "meaning": "Calm and peaceful.", "example": "The placid lake reflected the mountains.", "level": "Intermediate"},
    {"id": "w18", "word": "Eloquence", "phonetic": "/ˈel.ə.kwəns/", "meaning": "Fluent, powerful, and persuasive speaking.", "example": "Her eloquence convinced the audience.", "level": "Intermediate"},
    {"id": "w19", "word": "Catalyst", "phonetic": "/ˈkæt.ə.lɪst/", "meaning": "A person or thing that precipitates change.", "example": "Her speech was a catalyst for reform.", "level": "Intermediate"},
    {"id": "w20", "word": "Frivolous", "phonetic": "/ˈfrɪv.ə.ləs/", "meaning": "Not serious; silly or trivial.", "example": "Don't waste time on frivolous matters.", "level": "Intermediate"},
    {"id": "w21", "word": "Adept", "phonetic": "/əˈdept/", "meaning": "Very skilled or proficient.", "example": "She's adept at solving complex problems.", "level": "Beginner"},
    {"id": "w22", "word": "Perspicacious", "phonetic": "/ˌpɜː.spɪˈkeɪ.ʃəs/", "meaning": "Having keen insight and discernment.", "example": "His perspicacious observations were invaluable.", "level": "Advanced"},
    {"id": "w23", "word": "Tangible", "phonetic": "/ˈtæn.dʒə.bəl/", "meaning": "Able to be perceived by touch; real.", "example": "We need tangible evidence before proceeding.", "level": "Intermediate"},
    {"id": "w24", "word": "Obfuscate", "phonetic": "/ˈɒb.fəs.keɪt/", "meaning": "To deliberately make something unclear.", "example": "Don't obfuscate the facts.", "level": "Advanced"},
    {"id": "w25", "word": "Nascent", "phonetic": "/ˈneɪ.sənt/", "meaning": "Just beginning to exist or develop.", "example": "The nascent technology shows great promise.", "level": "Advanced"},
    {"id": "w26", "word": "Perennial", "phonetic": "/pəˈren.i.əl/", "meaning": "Lasting through the year or for many years.", "example": "That's a perennial favorite among students.", "level": "Intermediate"},
    {"id": "w27", "word": "Oblivious", "phonetic": "/əˈblɪv.i.əs/", "meaning": "Not aware or mindful of.", "example": "He seemed oblivious to her feelings.", "level": "Intermediate"},
    {"id": "w28", "word": "Magnanimous", "phonetic": "/mæɡˈnæn.ɪ.məs/", "meaning": "Generous and forgiving; noble.", "example": "A magnanimous leader inspires loyalty.", "level": "Advanced"},
    {"id": "w29", "word": "Ambiguous", "phonetic": "/æmˈbɪɡ.ju.əs/", "meaning": "Open to more than one interpretation.", "example": "His answer was ambiguous and unhelpful.", "level": "Intermediate"},
    {"id": "w30", "word": "Pragmatism", "phonetic": "/ˈpræɡ.mə.tɪz.əm/", "meaning": "An approach focused on practical results.", "example": "Her pragmatism helped solve the crisis.", "level": "Intermediate"},
    {"id": "w31", "word": "Petulant", "phonetic": "/ˈpet.jə.lənt/", "meaning": "Childishly sulky or easily annoyed.", "example": "He gave a petulant response to the criticism.", "level": "Intermediate"},
    {"id": "w32", "word": "Altruism", "phonetic": "/ˈæl.tru.ɪz.əm/", "meaning": "Concern for others; selflessness.", "example": "Her altruism inspired many people.", "level": "Intermediate"},
    {"id": "w33", "word": "Anomaly", "phonetic": "/əˈnɒm.ə.li/", "meaning": "Something that differs from the norm.", "example": "The test results showed an anomaly.", "level": "Intermediate"},
    {"id": "w34", "word": "Colloquial", "phonetic": "/kəˈloʊ.kwi.əl/", "meaning": "Used in ordinary conversation.", "example": "That's too colloquial for a formal essay.", "level": "Intermediate"},
    {"id": "w35", "word": "Incisive", "phonetic": "/ɪnˈsaɪ.sɪv/", "meaning": "Sharp, clear, and penetrating.", "example": "Her incisive analysis revealed the problem.", "level": "Advanced"},
    {"id": "w36", "word": "Jocular", "phonetic": "/ˈdʒɒk.jə.lər/", "meaning": "Joking or humorous in tone.", "example": "His jocular remarks lightened the mood.", "level": "Intermediate"},
    {"id": "w37", "word": "Languish", "phonetic": "/ˈlæŋ.ɡwɪʃ/", "meaning": "To lose strength or vitality; to long for.", "example": "The plants will languish without water.", "level": "Intermediate"},
    {"id": "w38", "word": "Nonchalant", "phonetic": "/ˌnɒnʃəˈlɑːnt/", "meaning": "Casually indifferent; unconcerned.", "example": "He gave a nonchalant shrug.", "level": "Intermediate"},
    {"id": "w39", "word": "Palpable", "phonetic": "/ˈpæl.pə.bəl/", "meaning": "Able to be touched or felt; obvious.", "example": "The tension in the room was palpable.", "level": "Intermediate"},
    {"id": "w40", "word": "Quixotic", "phonetic": "/kwɪkˈsɒt.ɪk/", "meaning": "Exceedingly idealistic; unrealistic.", "example": "His quixotic dreams seemed impossible.", "level": "Advanced"},
    {"id": "w41", "word": "Resonant", "phonetic": "/ˈrez.ə.nənt/", "meaning": "Producing a loud, deep sound; having profound meaning.", "example": "Her words were resonant with truth.", "level": "Advanced"},
    {"id": "w42", "word": "Sagacious", "phonetic": "/səˈɡeɪ.ʃəs/", "meaning": "Wise and discerning; showing good judgment.", "example": "His sagacious advice proved invaluable.", "level": "Advanced"},
    {"id": "w43", "word": "Tacit", "phonetic": "/ˈtæs.ɪt/", "meaning": "Understood or implied without being stated.", "example": "There was a tacit agreement between them.", "level": "Intermediate"},
    {"id": "w44", "word": "Unequivocal", "phonetic": "/ˌʌn.ɪˈkwɪv.ə.kəl/", "meaning": "Clear and unambiguous; absolute.", "example": "She gave an unequivocal no.", "level": "Advanced"},
    {"id": "w45", "word": "Vacillate", "phonetic": "/ˈvæs.ɪ.leɪt/", "meaning": "To waver between decisions.", "example": "He tends to vacillate on important choices.", "level": "Advanced"},
    {"id": "w46", "word": "Whimsical", "phonetic": "/ˈwɪm.zɪ.kəl/", "meaning": "Playfully quaint or fanciful.", "example": "The painting had a whimsical charm.", "level": "Intermediate"},
    {"id": "w47", "word": "Xenial", "phonetic": "/ˈzen.i.əl/", "meaning": "Hospitable and generous to guests.", "example": "They gave us a xenial welcome.", "level": "Advanced"},
    {"id": "w48", "word": "Zealous", "phonetic": "/ˈzel.əs/", "meaning": "Filled with passionate energy and eagerness.", "example": "She's zealous about environmental causes.", "level": "Intermediate"},
    {"id": "w49", "word": "Zephyr", "phonetic": "/ˈzef.ər/", "meaning": "A gentle breeze.", "example": "A warm zephyr swept across the garden.", "level": "Intermediate"},
    {"id": "w50", "word": "Euphoria", "phonetic": "/juːˈfɔː.ri.ə/", "meaning": "A state of intense happiness and confidence.", "example": "The victory brought euphoria to the team.", "level": "Intermediate"},
]

DAILY_CHALLENGES = [
    {"id": "c1", "title": "Speak for 5 minutes", "description": "Practice speaking for 5 minutes today.", "xp": 50, "type": "speak", "target": 5, "icon": "mic"},
    {"id": "c2", "title": "Learn 20 new words", "description": "Add 20 words to your vocabulary.", "xp": 40, "type": "vocab", "target": 20, "icon": "book"},
    {"id": "c3", "title": "Complete a Quiz", "description": "Ace today's grammar quiz.", "xp": 30, "type": "quiz", "target": 1, "icon": "help-circle"},
    {"id": "c4", "title": "Finish 1 Lesson", "description": "Complete any English lesson.", "xp": 25, "type": "lesson", "target": 1, "icon": "school"},
]

QUIZ_QUESTIONS = [
    {"id": "q1", "question": "Which sentence is correct?", "options": ["He don't like tea.", "He doesn't like tea.", "He not likes tea.", "He no like tea."], "answer": 1},
    {"id": "q2", "question": "Choose the correct past tense of 'go'.", "options": ["goed", "gone", "went", "going"], "answer": 2},
    {"id": "q3", "question": "'I ___ studying English for two years.'", "options": ["am", "have been", "was", "will"], "answer": 1},
    {"id": "q4", "question": "Which is a synonym for 'happy'?", "options": ["Sorrow", "Elated", "Weary", "Fierce"], "answer": 1},
    {"id": "q5", "question": "Pick the correct article: 'She is ___ honest person.'", "options": ["a", "an", "the", "no article"], "answer": 1},
    {"id": "q6", "question": "Choose the correct spelling:", "options": ["Occured", "Occured", "Occurred", "Ocurred"], "answer": 2},
    {"id": "q7", "question": "What is the opposite of 'generous'?", "options": ["Kind", "Selfish", "Caring", "Thoughtful"], "answer": 1},
    {"id": "q8", "question": "'If I were you, I ___ accept the offer.'", "options": ["will", "would", "am", "should"], "answer": 1},
    {"id": "q9", "question": "Which word means 'extremely tired'?", "options": ["Energetic", "Exhausted", "Alert", "Awake"], "answer": 1},
    {"id": "q10", "question": "'She has always ___ her dreams despite challenges.'", "options": ["pursue", "pursues", "pursued", "pursuing"], "answer": 2},
    {"id": "q11", "question": "What does 'break the ice' mean?", "options": ["To damage ice physically", "To start a conversation or make people comfortable", "To freeze something", "To go ice skating"], "answer": 1},
    {"id": "q12", "question": "What idiom means 'to stop worrying about something'?", "options": ["Let the cat out", "Let it go", "Keep your cool", "Let it be"], "answer": 1},
    {"id": "q13", "question": "Which phrase means 'to fail or not succeed'?", "options": ["Hit the mark", "Miss the boat", "Hit the road", "Miss the point"], "answer": 1},
    {"id": "q14", "question": "What does 'cost an arm and a leg' mean?", "options": ["Requires physical exercise", "Is very expensive", "Is difficult to transport", "Requires surgery"], "answer": 1},
    {"id": "q15", "question": "What idiom means 'to work hard'?", "options": ["Burn the bridge", "Burn the midnight oil", "Burn the candle", "Burn out"], "answer": 1},
    {"id": "q16", "question": "Which phrase means 'to leave quickly'?", "options": ["Take a break", "Take the plunge", "Take off", "Take time"], "answer": 2},
    {"id": "q17", "question": "What does 'under the weather' mean?", "options": ["Standing below an umbrella", "Feeling sick or unwell", "During rainy season", "Hiding from weather"], "answer": 1},
    {"id": "q18", "question": "What idiom means 'to speak your mind'?", "options": ["Bite your tongue", "Speak volumes", "Speak your piece", "Speak softly"], "answer": 2},
    {"id": "q19", "question": "Which phrase means 'something that will definitely happen'?", "options": ["A piece of cake", "A ball in the court", "A sure thing", "A long shot"], "answer": 2},
    {"id": "q20", "question": "What does 'hit the nail on the head' mean?", "options": ["To use a hammer", "To state the exact truth", "To hurt yourself", "To build something"], "answer": 1},
]

MOTIVATIONAL_QUOTES = [
    "Every expert was once a beginner.",
    "Speak with confidence, learn with courage.",
    "One conversation a day keeps hesitation away.",
    "Fluency is a marathon, not a sprint.",
    "Small daily practice creates giant leaps.",
]

ACHIEVEMENTS = [
    {"id": "first-lesson", "title": "First Steps", "description": "Complete your first lesson", "icon": "footsteps"},
    {"id": "streak-7", "title": "Week Warrior", "description": "Maintain a 7-day streak", "icon": "flame"},
    {"id": "streak-30", "title": "Consistent Champion", "description": "30-day streak", "icon": "trophy"},
    {"id": "xp-500", "title": "Rising Star", "description": "Earn 500 XP", "icon": "star"},
    {"id": "xp-2000", "title": "XP Titan", "description": "Earn 2000 XP", "icon": "medal"},
    {"id": "test-pass", "title": "Test Ace", "description": "Score 80+ on a speaking test", "icon": "ribbon"},
    {"id": "words-50", "title": "Word Collector", "description": "Save 50 vocabulary words", "icon": "library"},
    {"id": "premium", "title": "Premium Member", "description": "Unlock premium access", "icon": "diamond"},
]

# Seed live rooms in-memory-ish (persist in mongo idempotently)
SEED_ROOMS = [
    {"room_id": "seed-1", "title": "Everyday Conversations", "topic": "Daily English", "host_name": "Ananya", "host_avatar": "https://i.pravatar.cc/150?img=47", "participant_count": 12, "is_private": False, "is_seed": True},
    {"room_id": "seed-2", "title": "Ace Your Job Interview", "topic": "Interview English", "host_name": "Rohan", "host_avatar": "https://i.pravatar.cc/150?img=12", "participant_count": 8, "is_private": False, "is_seed": True},
    {"room_id": "seed-3", "title": "IELTS Speaking Bootcamp", "topic": "IELTS", "host_name": "Priya", "host_avatar": "https://i.pravatar.cc/150?img=32", "participant_count": 24, "is_private": False, "is_seed": True},
    {"room_id": "seed-4", "title": "Travel Talks", "topic": "Travel English", "host_name": "Marco", "host_avatar": "https://i.pravatar.cc/150?img=15", "participant_count": 5, "is_private": False, "is_seed": True},
    {"room_id": "seed-5", "title": "Confidence in Public Speaking", "topic": "Public Speaking", "host_name": "Zara", "host_avatar": "https://i.pravatar.cc/150?img=44", "participant_count": 17, "is_private": False, "is_seed": True},
]

# Partner pool for random matching
PARTNER_POOL = [
    {"name": "Aisha", "avatar": "https://i.pravatar.cc/150?img=48", "gender": "female", "country": "India"},
    {"name": "Diego", "avatar": "https://i.pravatar.cc/150?img=13", "gender": "male", "country": "Spain"},
    {"name": "Yuki", "avatar": "https://i.pravatar.cc/150?img=25", "gender": "female", "country": "Japan"},
    {"name": "Liam", "avatar": "https://i.pravatar.cc/150?img=8", "gender": "male", "country": "Ireland"},
    {"name": "Sofia", "avatar": "https://i.pravatar.cc/150?img=36", "gender": "female", "country": "Brazil"},
    {"name": "Ravi", "avatar": "https://i.pravatar.cc/150?img=11", "gender": "male", "country": "India"},
    {"name": "Emma", "avatar": "https://i.pravatar.cc/150?img=45", "gender": "female", "country": "UK"},
    {"name": "Kenji", "avatar": "https://i.pravatar.cc/150?img=17", "gender": "male", "country": "Japan"},
]

# Stripe subscription plan config (server-authoritative pricing)
# Backend-friendly tiers mapped from frontend display (marketing prices in INR):
#   - ₹49 Pack (weekly)   → 0.59 USD, 7 day recurring
#   - ₹199 Pack (monthly) → 9.99 USD, 30 day recurring  
#   - ₹499 Pack (quarterly) → 14.99 USD, 90 day recurring
# Note: Frontend displays rupee prices for UX; Stripe charges USD amounts.
# Transitioning to real INR pricing later only requires adding new SKUs here.
STRIPE_PLANS = {
    "weekly": {"amount": 0.59, "currency": "usd", "label": "Weekly", "duration_days": 7},
    "monthly": {"amount": 9.99, "currency": "usd", "label": "Monthly", "duration_days": 30},
    "quarterly": {"amount": 14.99, "currency": "usd", "label": "Quarterly", "duration_days": 90},
    "yearly": {"amount": 79.99, "currency": "usd", "label": "Yearly", "duration_days": 365},
}

# ---------- Startup ----------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    # Drop legacy sparse indexes if present — they treated `null` as a value and
    # caused duplicate-key errors on every new user with phone/referral_code = None.
    for legacy_name in ("phone_1", "referral_code_1"):
        try:
            await db.users.drop_index(legacy_name)
        except Exception:
            pass
    # Partial unique indexes: only enforce uniqueness when the field is a real string.
    await db.users.create_index(
        "phone", unique=True,
        partialFilterExpression={"phone": {"$type": "string"}},
    )
    await db.users.create_index(
        "referral_code", unique=True,
        partialFilterExpression={"referral_code": {"$type": "string"}},
    )
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.payments.create_index("session_id", unique=True)
    await db.phone_otps.create_index("phone", unique=True)
    await db.phone_otps.create_index("expires_at", expireAfterSeconds=0)
    # Seed rooms
    for r in SEED_ROOMS:
        await db.rooms.update_one({"room_id": r["room_id"]}, {"$setOnInsert": r}, upsert=True)

# ---------- Auth ----------
@api.post("/auth/session")
async def create_session(payload: SessionCreate):
    session_id = payload.session_id
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.get(EMERGENT_AUTH_URL, headers={"X-Session-ID": session_id})
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session_id")
        data = r.json()

    email = data["email"].lower().strip()
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture")
    session_token = data["session_token"]

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        referral_code = await _unique_referral_code(name)
        user = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "english_level": "Beginner",
            "xp": 0,
            "streak": 0,
            "last_active_date": None,
            "daily_goal_minutes": 15,
            "daily_goal_completed_minutes": 0,
            "is_premium": False,
            "premium_plan": None,
            "premium_until": None,
            "saved_words": [],
            "friends": [],
            "blocked": [],
            "achievements": [],
            "certificates": [],
            "phone": None,
            "referral_code": referral_code,
            "referred_by": None,
            "referral_count": 0,
            "referral_discount_active": False,
            "created_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(user)
        user.pop("_id", None)
    else:
        # Update picture if changed
        await db.users.update_one({"email": email}, {"$set": {"picture": picture, "name": name}})
        # Backfill referral_code for existing users
        if not user.get("referral_code"):
            code = await _unique_referral_code(name)
            await db.users.update_one({"email": email}, {"$set": {"referral_code": code}})
            user["referral_code"] = code

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {"$set": {
            "session_token": session_token,
            "user_id": user["user_id"],
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    return {"session_token": session_token, "user": _user_to_out(user).model_dump()}

@api.get("/auth/me", response_model=UserOut)
async def me(user=Depends(get_current_user)):
    return _user_to_out(user)

@api.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}

# ---------- Phone OTP (MOCK mode; swap to Twilio later) ----------
# ⚠️ MOCK MODE: this path accepts ANY 6-digit code and returns the stored OTP in the response
#     for demo/testing. To switch to real OTP delivery:
#       1) Set OTP_MODE=twilio in env
#       2) Implement send via Twilio in _send_otp() below (or another provider)
#       3) Remove `debug_code` from the send-otp response
OTP_MODE = os.environ.get("OTP_MODE", "mock")

def _normalize_phone(p: str) -> str:
    return "+" + "".join(c for c in p if c.isdigit())

async def _send_otp(phone: str, code: str) -> None:
    if OTP_MODE == "mock":
        logger.info(f"[MOCK OTP] phone={phone} code={code}")
        return
    # TODO: Real provider dispatch (Twilio, MSG91, etc.)
    logger.warning(f"OTP_MODE={OTP_MODE} not implemented; falling back to mock log")

@api.post("/auth/phone/send-otp")
async def send_otp(payload: PhoneSendOtp):
    import random
    phone = _normalize_phone(payload.phone)
    if len(phone) < 8:
        raise HTTPException(400, "Invalid phone number")
    code = f"{random.randint(0, 999999):06d}"
    await db.phone_otps.update_one(
        {"phone": phone},
        {"$set": {
            "phone": phone,
            "code": code,
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
            "attempts": 0,
        }},
        upsert=True,
    )
    await _send_otp(phone, code)
    body: Dict[str, Any] = {"ok": True, "phone": phone}
    if OTP_MODE == "mock":
        # In mock mode, we don't actually deliver — surface the code so the tester can see it.
        # Frontend also accepts any 6-digit code (see verify-otp).
        body["debug_code"] = code
        body["hint"] = "MOCK OTP: any 6-digit code works, or use debug_code."
    return body

@api.post("/auth/phone/verify-otp")
async def verify_otp(payload: PhoneVerifyOtp):
    phone = _normalize_phone(payload.phone)
    code = (payload.code or "").strip()
    if not (len(code) == 6 and code.isdigit()):
        raise HTTPException(400, "Code must be 6 digits")

    otp = await db.phone_otps.find_one({"phone": phone}, {"_id": 0})
    if OTP_MODE == "mock":
        # Accept ANY 6-digit code, but still require /send-otp was called (has record)
        if not otp:
            raise HTTPException(400, "Request an OTP first")
    else:
        if not otp or otp.get("code") != code:
            raise HTTPException(400, "Invalid or expired code")
        exp = otp.get("expires_at")
        if exp and exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp and exp < datetime.now(timezone.utc):
            raise HTTPException(400, "Code expired. Request a new one.")

    # find or create user
    user = await db.users.find_one({"phone": phone}, {"_id": 0})
    if not user:
        display_name = (payload.name or "").strip() or f"User {phone[-4:]}"
        # Synthesize a placeholder email so we keep email unique-index invariants
        placeholder_email = f"phone_{phone.lstrip('+')}@lingua-franca.phone"
        existing_email = await db.users.find_one({"email": placeholder_email}, {"_id": 0})
        if existing_email:
            user = existing_email
            await db.users.update_one({"email": placeholder_email}, {"$set": {"phone": phone}})
        else:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            referral_code = await _unique_referral_code(display_name)
            new_user = {
                "user_id": user_id,
                "email": placeholder_email,
                "name": display_name,
                "picture": None,
                "english_level": "Beginner",
                "xp": 0,
                "streak": 0,
                "last_active_date": None,
                "daily_goal_minutes": 15,
                "daily_goal_completed_minutes": 0,
                "is_premium": False,
                "premium_plan": None,
                "premium_until": None,
                "saved_words": [],
                "friends": [],
                "blocked": [],
                "achievements": [],
                "certificates": [],
                "phone": phone,
                "referral_code": referral_code,
                "referred_by": None,
                "referral_count": 0,
                "referral_discount_active": False,
                "created_at": datetime.now(timezone.utc),
            }
            # Apply referral if provided
            if payload.referral_code:
                inviter = await db.users.find_one({"referral_code": payload.referral_code.strip().upper()}, {"_id": 0})
                if inviter and inviter["user_id"] != user_id:
                    new_user["referred_by"] = inviter["user_id"]
                    new_user["referral_discount_active"] = True
                    await db.users.update_one(
                        {"user_id": inviter["user_id"]},
                        {"$inc": {"referral_count": 1}, "$set": {"referral_discount_active": True}},
                    )
            await db.users.insert_one(new_user)
            user = new_user
            user.pop("_id", None)

    # issue a token
    session_token = f"phone_{uuid.uuid4().hex}"
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {"$set": {
            "session_token": session_token,
            "user_id": user["user_id"],
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    # invalidate OTP record after successful verify
    await db.phone_otps.delete_one({"phone": phone})

    return {"session_token": session_token, "user": _user_to_out(user).model_dump()}

@api.post("/auth/phone/link", response_model=UserOut)
async def link_phone(payload: LinkPhone, user=Depends(get_current_user)):
    """Link a phone number to the currently-signed-in user (e.g., after Google login)."""
    phone = _normalize_phone(payload.phone)
    code = (payload.code or "").strip()
    if not (len(code) == 6 and code.isdigit()):
        raise HTTPException(400, "Code must be 6 digits")
    otp = await db.phone_otps.find_one({"phone": phone}, {"_id": 0})
    if OTP_MODE != "mock":
        if not otp or otp.get("code") != code:
            raise HTTPException(400, "Invalid code")
    else:
        if not otp:
            raise HTTPException(400, "Request an OTP first")
    # Ensure phone isn't already in use by another user
    existing = await db.users.find_one({"phone": phone, "user_id": {"$ne": user["user_id"]}}, {"_id": 0})
    if existing:
        raise HTTPException(409, "This phone number is already linked to another account")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"phone": phone}})
    await db.phone_otps.delete_one({"phone": phone})
    fresh = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return _user_to_out(fresh)

# ---------- Referral ----------
@api.get("/referral")
async def get_referral(user=Depends(get_current_user)):
    code = user.get("referral_code")
    if not code:
        code = await _unique_referral_code(user.get("name", "USER"))
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"referral_code": code}})
    return {
        "referral_code": code,
        "referral_count": user.get("referral_count", 0),
        "referral_discount_active": user.get("referral_discount_active", False),
        "share_message": f"Learn English with me on Lingua Franca! Use my code {code} to get 20% off Premium. Download: https://lingua-franca-6.preview.emergentagent.com",
    }

@api.post("/referral/apply", response_model=UserOut)
async def apply_referral(payload: ApplyReferral, user=Depends(get_current_user)):
    if user.get("referred_by"):
        raise HTTPException(400, "You've already used a referral code")
    code = payload.referral_code.strip().upper()
    inviter = await db.users.find_one({"referral_code": code}, {"_id": 0})
    if not inviter:
        raise HTTPException(404, "Invalid referral code")
    if inviter["user_id"] == user["user_id"]:
        raise HTTPException(400, "You can't use your own code")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"referred_by": inviter["user_id"], "referral_discount_active": True}})
    await db.users.update_one({"user_id": inviter["user_id"]}, {"$inc": {"referral_count": 1}, "$set": {"referral_discount_active": True}})
    fresh = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return _user_to_out(fresh)


# ---------- Profile & progression ----------
@api.put("/profile", response_model=UserOut)
async def update_profile(payload: UpdateProfile, user=Depends(get_current_user)):
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if updates:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
    fresh = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return _user_to_out(fresh)

def _today_iso() -> str:
    return datetime.now(timezone.utc).date().isoformat()

async def _apply_xp(user: Dict[str, Any], amount: int, minutes: int = 0) -> Dict[str, Any]:
    today = _today_iso()
    last = user.get("last_active_date")
    new_streak = user.get("streak", 0)
    if last != today:
        if last:
            try:
                last_date = datetime.fromisoformat(last).date()
                delta = (datetime.now(timezone.utc).date() - last_date).days
                new_streak = new_streak + 1 if delta == 1 else 1
            except Exception:
                new_streak = 1
        else:
            new_streak = 1

    new_xp = user.get("xp", 0) + amount
    new_minutes = user.get("daily_goal_completed_minutes", 0) + (minutes or 0)
    if last != today:
        new_minutes = minutes or 0

    # Achievement checks
    achievements = list(user.get("achievements", []))
    def unlock(aid):
        if aid not in achievements:
            achievements.append(aid)
    if new_xp >= 500:
        unlock("xp-500")
    if new_xp >= 2000:
        unlock("xp-2000")
    if new_streak >= 7:
        unlock("streak-7")
    if new_streak >= 30:
        unlock("streak-30")

    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "xp": new_xp,
            "streak": new_streak,
            "last_active_date": today,
            "daily_goal_completed_minutes": new_minutes,
            "achievements": achievements,
        }},
    )
    return await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})

@api.post("/xp", response_model=UserOut)
async def add_xp(payload: XPEvent, user=Depends(get_current_user)):
    fresh = await _apply_xp(user, payload.amount, payload.minutes or 0)
    return _user_to_out(fresh)

# ---------- Home ----------
@api.get("/home")
async def home(user=Depends(get_current_user)):
    # Reset daily if new day
    today = _today_iso()
    if user.get("last_active_date") != today:
        # Do not reset streak here, only on xp addition
        pass
    quote_index = datetime.now(timezone.utc).day % len(MOTIVATIONAL_QUOTES)
    # continue learning: pick a lesson matching user's level
    lvl = user.get("english_level", "Beginner")
    continue_lesson = next((lsn for lsn in LESSONS if lsn["level"] == lvl), LESSONS[0])
    daily_word = VOCAB_WORDS[datetime.now(timezone.utc).day % len(VOCAB_WORDS)]
    return {
        "welcome_name": user.get("name", "Learner").split(" ")[0],
        "quote": MOTIVATIONAL_QUOTES[quote_index],
        "daily_goal_minutes": user.get("daily_goal_minutes", 15),
        "daily_goal_completed_minutes": user.get("daily_goal_completed_minutes", 0) if user.get("last_active_date") == today else 0,
        "streak": user.get("streak", 0),
        "xp": user.get("xp", 0),
        "continue_lesson": continue_lesson,
        "word_of_the_day": daily_word,
        "categories": LESSON_CATEGORIES,
        "challenges": DAILY_CHALLENGES,
    }

# ---------- Lessons ----------
@api.get("/lessons/categories")
async def lesson_categories():
    return {"categories": LESSON_CATEGORIES}

@api.get("/lessons")
async def lessons(category_id: Optional[str] = None):
    items = [lsn for lsn in LESSONS if (category_id is None or lsn["category_id"] == category_id)]
    return {"lessons": items}

@api.get("/lessons/{lesson_id}")
async def lesson_detail(lesson_id: str):
    lsn = next((x for x in LESSONS if x["id"] == lesson_id), None)
    if not lsn:
        raise HTTPException(404, "Lesson not found")
    return lsn

@api.post("/lessons/complete")
async def complete_lesson(payload: LessonProgressUpdate, user=Depends(get_current_user)):
    lsn = next((x for x in LESSONS if x["id"] == payload.lesson_id), None)
    if not lsn:
        raise HTTPException(404, "Lesson not found")
    await db.lesson_progress.update_one(
        {"user_id": user["user_id"], "lesson_id": payload.lesson_id},
        {"$set": {"completed": True, "completed_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    achievements = list(user.get("achievements", []))
    if "first-lesson" not in achievements:
        achievements.append("first-lesson")
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"achievements": achievements}})
        user["achievements"] = achievements
    fresh = await _apply_xp(user, lsn["xp_reward"], lsn["duration_minutes"])
    return {"user": _user_to_out(fresh).model_dump(), "xp_earned": lsn["xp_reward"]}

@api.get("/lessons/progress/all")
async def all_progress(user=Depends(get_current_user)):
    rows = await db.lesson_progress.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    return {"completed_ids": [r["lesson_id"] for r in rows]}

# ---------- Vocabulary ----------
@api.get("/vocab")
async def vocab_list():
    return {"words": VOCAB_WORDS}

@api.get("/vocab/word-of-the-day")
async def word_of_the_day():
    return VOCAB_WORDS[datetime.now(timezone.utc).day % len(VOCAB_WORDS)]

@api.post("/vocab/save", response_model=UserOut)
async def save_word(payload: VocabAction, user=Depends(get_current_user)):
    saved = list(user.get("saved_words", []))
    if payload.word_id not in saved:
        saved.append(payload.word_id)
    if len(saved) >= 50 and "words-50" not in user.get("achievements", []):
        ach = list(user.get("achievements", [])) + ["words-50"]
    else:
        ach = user.get("achievements", [])
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"saved_words": saved, "achievements": ach}})
    fresh = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return _user_to_out(fresh)

@api.post("/vocab/unsave", response_model=UserOut)
async def unsave_word(payload: VocabAction, user=Depends(get_current_user)):
    saved = [w for w in user.get("saved_words", []) if w != payload.word_id]
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"saved_words": saved}})
    fresh = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return _user_to_out(fresh)

# ---------- Challenges & Quiz ----------
@api.get("/challenges")
async def challenges(user=Depends(get_current_user)):
    today = _today_iso()
    row = await db.daily_challenges.find_one({"user_id": user["user_id"], "date": today}, {"_id": 0})
    completed = row.get("completed", []) if row else []
    return {"challenges": DAILY_CHALLENGES, "completed": completed}

@api.post("/challenges/{challenge_id}/complete")
async def complete_challenge(challenge_id: str, user=Depends(get_current_user)):
    ch = next((c for c in DAILY_CHALLENGES if c["id"] == challenge_id), None)
    if not ch:
        raise HTTPException(404, "Challenge not found")
    today = _today_iso()
    row = await db.daily_challenges.find_one({"user_id": user["user_id"], "date": today}, {"_id": 0}) or {"user_id": user["user_id"], "date": today, "completed": []}
    if challenge_id in row.get("completed", []):
        raise HTTPException(400, "Already completed today")
    row["completed"] = row.get("completed", []) + [challenge_id]
    await db.daily_challenges.update_one({"user_id": user["user_id"], "date": today}, {"$set": row}, upsert=True)
    fresh = await _apply_xp(user, ch["xp"], ch.get("target", 0) if ch["type"] == "speak" else 0)
    return {"user": _user_to_out(fresh).model_dump(), "xp_earned": ch["xp"]}

@api.get("/quiz")
async def get_quiz():
    return {"questions": QUIZ_QUESTIONS}

# ---------- Speaking Test ----------
@api.post("/speaking-test", response_model=UserOut)
async def submit_speaking_test(payload: SpeakingTestResult, user=Depends(get_current_user)):
    doc = {
        "user_id": user["user_id"],
        "level": payload.level,
        "fluency": payload.fluency,
        "pronunciation": payload.pronunciation,
        "grammar": payload.grammar,
        "vocabulary": payload.vocabulary,
        "overall": payload.overall,
        "created_at": datetime.now(timezone.utc),
    }
    await db.speaking_tests.insert_one(doc)
    achievements = list(user.get("achievements", []))
    certificates = list(user.get("certificates", []))
    if payload.overall >= 80:
        if "test-pass" not in achievements:
            achievements.append("test-pass")
        certificates.append({
            "id": f"cert_{uuid.uuid4().hex[:8]}",
            "title": f"{payload.level.title()} Speaking Certificate",
            "score": payload.overall,
            "date": _today_iso(),
        })
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"achievements": achievements, "certificates": certificates}})
    fresh = await _apply_xp(user, 100, 5)
    return _user_to_out(fresh)

@api.get("/speaking-test/history")
async def test_history(user=Depends(get_current_user)):
    rows = await db.speaking_tests.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    for r in rows:
        r["created_at"] = r["created_at"].isoformat() if isinstance(r.get("created_at"), datetime) else r.get("created_at")
    return {"results": rows}

# ---------- Speak with Real People (mocked) ----------
@api.post("/match")
async def find_match(gender: str = "any", user=Depends(get_current_user)):
    import random
    pool = PARTNER_POOL
    if gender in ("male", "female"):
        pool = [p for p in PARTNER_POOL if p["gender"] == gender]
    if not pool:
        pool = PARTNER_POOL
    partner = random.choice(pool)
    room_id = f"lf_{uuid.uuid4().hex[:16]}"
    return {"partner": partner, "room_id": room_id}

@api.post("/calls")
async def log_call(payload: CallLogCreate, user=Depends(get_current_user)):
    doc = {
        "call_id": f"call_{uuid.uuid4().hex[:10]}",
        "user_id": user["user_id"],
        "partner_name": payload.partner_name,
        "partner_avatar": payload.partner_avatar,
        "duration_seconds": payload.duration_seconds,
        "partner_gender": payload.partner_gender,
        "created_at": datetime.now(timezone.utc),
    }
    await db.calls.insert_one(doc)
    minutes = max(1, payload.duration_seconds // 60)
    await _apply_xp(user, minutes * 10, minutes)
    return {"ok": True}

@api.get("/calls")
async def call_history(user=Depends(get_current_user)):
    rows = await db.calls.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    for r in rows:
        r["created_at"] = r["created_at"].isoformat() if isinstance(r.get("created_at"), datetime) else r.get("created_at")
    return {"calls": rows}

@api.post("/friends/request")
async def send_friend_request(payload: FriendRequestCreate, user=Depends(get_current_user)):
    doc = {
        "request_id": f"fr_{uuid.uuid4().hex[:10]}",
        "user_id": user["user_id"],
        "to_name": payload.to_name,
        "to_avatar": payload.to_avatar,
        "status": "sent",
        "created_at": datetime.now(timezone.utc),
    }
    await db.friend_requests.insert_one(doc)
    return {"ok": True, "request_id": doc["request_id"]}

@api.get("/friends/requests")
async def list_friend_requests(user=Depends(get_current_user)):
    rows = await db.friend_requests.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    for r in rows:
        r["created_at"] = r["created_at"].isoformat() if isinstance(r.get("created_at"), datetime) else r.get("created_at")
    return {"requests": rows}

@api.post("/reports")
async def submit_report(payload: ReportCreate, user=Depends(get_current_user)):
    await db.reports.insert_one({
        "report_id": f"rep_{uuid.uuid4().hex[:10]}",
        "user_id": user["user_id"],
        "target_name": payload.target_name,
        "reason": payload.reason,
        "created_at": datetime.now(timezone.utc),
    })
    return {"ok": True}

@api.post("/block")
async def block_user(payload: ReportCreate, user=Depends(get_current_user)):
    blocked = list(user.get("blocked", []))
    if payload.target_name not in blocked:
        blocked.append(payload.target_name)
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"blocked": blocked}})
    return {"ok": True}

# ---------- ZEGOCLOUD Voice Token (Token04) ----------
# Official ZEGO Token04 algorithm implemented in-process (no SDK install).
# Payload:  expire_time_i64_be | iv_len_i16_be | iv | ct_len_i16_be | ct
# Cipher:   AES/CBC/PKCS7  (key = ZEGO_SERVER_SECRET utf-8, must be exactly 32 chars)
def _generate_zego_token04(app_id: int, user_id: str, secret: str, effective_time_seconds: int, payload: str = "") -> str:
    import base64
    import json as _json
    import os as _os
    import random as _random
    import struct
    import time as _time
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    from cryptography.hazmat.primitives import padding as _padding

    if not isinstance(app_id, int) or app_id <= 0:
        raise ValueError("app_id must be a positive integer")
    if not user_id:
        raise ValueError("user_id required")
    if not secret or len(secret) != 32:
        raise ValueError("ZEGO_SERVER_SECRET must be exactly 32 characters")
    if effective_time_seconds <= 0:
        raise ValueError("effective_time_seconds must be > 0")

    create_time = int(_time.time())
    token_info = {
        "app_id": app_id,
        "user_id": user_id,
        "nonce": _random.randint(-2147483648, 2147483647),
        "ctime": create_time,
        "expire": create_time + effective_time_seconds,
        "payload": payload or "",
    }
    plain_text = _json.dumps(token_info, separators=(",", ":"), ensure_ascii=False).encode("utf-8")

    iv = _os.urandom(16)
    key = secret.encode("utf-8")

    padder = _padding.PKCS7(algorithms.AES.block_size).padder()
    padded = padder.update(plain_text) + padder.finalize()

    cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
    encryptor = cipher.encryptor()
    ciphertext = encryptor.update(padded) + encryptor.finalize()

    buf = struct.pack(">q", token_info["expire"])
    buf += struct.pack(">h", len(iv)) + iv
    buf += struct.pack(">h", len(ciphertext)) + ciphertext

    return "04" + base64.b64encode(buf).decode("utf-8")

@api.post("/zego/token")
async def zego_token(payload: ZegoTokenRequest, user=Depends(get_current_user)):
    if not ZEGO_APP_ID or not ZEGO_SERVER_SECRET:
        raise HTTPException(status_code=503, detail="ZEGOCLOUD is not configured on the server")
    try:
        app_id_int = int(ZEGO_APP_ID)
    except (TypeError, ValueError):
        raise HTTPException(status_code=500, detail="ZEGO_APP_ID must be a numeric value")

    room_id = (payload.room_id or "").strip()
    if not room_id:
        raise HTTPException(status_code=400, detail="room_id required")

    effective_time = 3600  # 1 hour
    try:
        token = _generate_zego_token04(
            app_id=app_id_int,
            user_id=user["user_id"],
            secret=ZEGO_SERVER_SECRET,
            effective_time_seconds=effective_time,
            payload="",
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "app_id": app_id_int,
        "room_id": room_id,
        "user_id": user["user_id"],
        "token": token,
        "effective_time": effective_time,
    }

# ---------- Live Rooms ----------
@api.get("/rooms")
async def list_rooms():
    rows = await db.rooms.find({}, {"_id": 0}).to_list(100)
    return {"rooms": rows}

@api.post("/rooms")
async def create_room(payload: RoomCreate, user=Depends(get_current_user)):
    room = {
        "room_id": f"room_{uuid.uuid4().hex[:10]}",
        "title": payload.title,
        "topic": payload.topic,
        "host_name": user.get("name", "Host"),
        "host_avatar": user.get("picture") or "https://i.pravatar.cc/150?img=5",
        "participant_count": 1,
        "is_private": payload.is_private,
        "is_seed": False,
        "created_at": datetime.now(timezone.utc),
    }
    await db.rooms.insert_one(room)
    room.pop("_id", None)
    if isinstance(room.get("created_at"), datetime):
        room["created_at"] = room["created_at"].isoformat()
    return room

@api.post("/rooms/join")
async def join_room(payload: RoomJoin, user=Depends(get_current_user)):
    room = await db.rooms.find_one({"room_id": payload.room_id}, {"_id": 0})
    if not room:
        raise HTTPException(404, "Room not found")
    await db.rooms.update_one({"room_id": payload.room_id}, {"$inc": {"participant_count": 1}})
    return {"ok": True}

# ---------- Leaderboard ----------
@api.get("/leaderboard")
async def leaderboard(user=Depends(get_current_user)):
    rows = await db.users.find({}, {"_id": 0, "name": 1, "picture": 1, "xp": 1, "user_id": 1, "streak": 1}).sort("xp", -1).to_list(20)
    # Also include a few seed entries if less than 5 real users
    seed = [
        {"user_id": "seed_1", "name": "Ananya Sharma", "picture": "https://i.pravatar.cc/150?img=47", "xp": 4820, "streak": 42},
        {"user_id": "seed_2", "name": "Rohan Mehta", "picture": "https://i.pravatar.cc/150?img=12", "xp": 3910, "streak": 28},
        {"user_id": "seed_3", "name": "Emma Wilson", "picture": "https://i.pravatar.cc/150?img=45", "xp": 3260, "streak": 15},
        {"user_id": "seed_4", "name": "Kenji Tanaka", "picture": "https://i.pravatar.cc/150?img=17", "xp": 2890, "streak": 21},
        {"user_id": "seed_5", "name": "Sofia Alves", "picture": "https://i.pravatar.cc/150?img=36", "xp": 2410, "streak": 9},
    ]
    combined = rows + [s for s in seed if not any(r["user_id"] == s["user_id"] for r in rows)]
    combined.sort(key=lambda x: x["xp"], reverse=True)
    return {"leaderboard": combined[:20], "me_user_id": user["user_id"]}

# ---------- Achievements ----------
@api.get("/achievements")
async def achievements(user=Depends(get_current_user)):
    unlocked = set(user.get("achievements", []))
    items = [{**a, "unlocked": a["id"] in unlocked} for a in ACHIEVEMENTS]
    return {"achievements": items}

# ---------- Stripe Subscription ----------
@api.get("/subscription/plans")
async def subscription_plans():
    return {"plans": STRIPE_PLANS}

@api.post("/subscription/checkout")
async def create_checkout(payload: CheckoutRequest, request: Request, user=Depends(get_current_user)):
    plan = STRIPE_PLANS.get(payload.plan)
    if not plan:
        raise HTTPException(400, "Invalid plan")
    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/premium/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/premium/cancel"

    # Apply referral discount (20% off) — server-authoritative
    base_amount = float(plan["amount"])
    discount_applied = False
    if user.get("referral_discount_active"):
        amount = round(base_amount * 0.8, 2)
        discount_applied = True
    else:
        amount = base_amount

    webhook_url = f"{origin}/api/webhook/stripe"
    stripe = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    checkout_request = CheckoutSessionRequest(
        amount=amount,
        currency=plan["currency"],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": user["user_id"],
            "plan": payload.plan,
            "email": user["email"],
            "referral_discount": "1" if discount_applied else "0",
        },
    )
    session = await stripe.create_checkout_session(checkout_request)

    await db.payments.insert_one({
        "session_id": session.session_id,
        "user_id": user["user_id"],
        "plan": payload.plan,
        "amount": amount,
        "base_amount": base_amount,
        "currency": plan["currency"],
        "status": "initiated",
        "payment_status": "pending",
        "referral_discount": discount_applied,
        "referred_by": user.get("referred_by"),
        "created_at": datetime.now(timezone.utc),
    })
    return {"url": session.url, "session_id": session.session_id, "amount": amount, "referral_discount": discount_applied}

@api.get("/subscription/status/{session_id}")
async def poll_checkout(session_id: str, user=Depends(get_current_user)):
    payment = await db.payments.find_one({"session_id": session_id}, {"_id": 0})
    if not payment:
        raise HTTPException(404, "Session not found")
    stripe = StripeCheckout(api_key=STRIPE_API_KEY)
    status = await stripe.get_checkout_status(session_id)

    # Update payment record
    await db.payments.update_one(
        {"session_id": session_id},
        {"$set": {"status": status.status, "payment_status": status.payment_status}},
    )

    # If just paid, upgrade user (idempotent — only once)
    if status.payment_status == "paid" and payment.get("payment_status") != "paid":
        plan = payment.get("plan", "monthly")
        duration = STRIPE_PLANS.get(plan, STRIPE_PLANS["monthly"])["duration_days"]
        until = datetime.now(timezone.utc) + timedelta(days=duration)
        ach = list(user.get("achievements", []))
        if "premium" not in ach:
            ach.append("premium")
        set_fields = {
            "is_premium": True,
            "premium_plan": plan,
            "premium_until": until.isoformat(),
            "achievements": ach,
        }
        # Consume the referral discount once redeemed
        if payment.get("referral_discount"):
            set_fields["referral_discount_active"] = False
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": set_fields})
        # Reward the referrer with the "referral" achievement bump (already active discount)
        referred_by = payment.get("referred_by")
        if referred_by:
            await db.users.update_one(
                {"user_id": referred_by},
                {"$set": {"referral_discount_active": True}},
            )

    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency,
    }

@api.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    signature = request.headers.get("Stripe-Signature")
    stripe = StripeCheckout(api_key=STRIPE_API_KEY)
    try:
        event = await stripe.handle_webhook(payload, signature)
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        raise HTTPException(400, "Invalid webhook")
    if event.event_type == "checkout.session.completed":
        session_id = event.session_id
        payment = await db.payments.find_one({"session_id": session_id}, {"_id": 0})
        if payment and event.payment_status == "paid" and payment.get("payment_status") != "paid":
            plan = payment.get("plan", "monthly")
            duration = STRIPE_PLANS.get(plan, STRIPE_PLANS["monthly"])["duration_days"]
            until = datetime.now(timezone.utc) + timedelta(days=duration)
            await db.users.update_one(
                {"user_id": payment["user_id"]},
                {"$set": {
                    "is_premium": True,
                    "premium_plan": plan,
                    "premium_until": until.isoformat(),
                }},
            )
            await db.payments.update_one(
                {"session_id": session_id},
                {"$set": {"status": "complete", "payment_status": "paid"}},
            )
    return {"received": True}

# ---------- Health ----------
@api.get("/")
async def root():
    return {"message": "Lingua Franca API online"}

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown():
    client.close()
