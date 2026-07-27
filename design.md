# Design System

## Purpose
Yeh file project ke core visual style, typography, spacing, colors, gradients, shadows aur reusable UI patterns describe karti hai. AI agent is file ko padhkar future page design decisions le sakta hai bina pura code scan kiye.

## Brand Colors

- `primary`: #1E3A8A
- `primaryLight`: #3B82F6
- `primaryDeeper`: #0F1F5C
- `accent`: #0D9488
- `gold`: #F59E0B
- `flame`: #EF4444
- `bg`: #F5F8FF
- `surface`: #FFFFFF
- `glass`: rgba(255,255,255,0.72)
- `glassBorder`: rgba(255,255,255,0.55)
- `textPrimary`: #0F172A
- `textSecondary`: #64748B
- `textMuted`: #94A3B8
- `divider`: #E2E8F0
- `successBg`: #DCFCE7
- `danger`: #DC2626
- `chipBg`: rgba(59,130,246,0.10)
- `chipActive`: #1E3A8A

## Gradient Palette

- `gradients.primary`: [#1E3A8A, #2563EB, #38BDF8]
- `gradients.soft`: [#DBEAFE, #F5F8FF]
- `gradients.gold`: [#FBBF24, #F59E0B]
- `gradients.dark`: [#0B1338, #1E3A8A]
- `gradients.premium`: [#0F172A, #1E3A8A, #312E81]

## Typography

### Fonts
- `Outfit` for headings and strong UI labels
- `Manrope` for body text and supporting copy

### Loaded font weights
- Outfit_400Regular
- Outfit_500Medium
- Outfit_600SemiBold
- Outfit_700Bold
- Outfit_800ExtraBold
- Manrope_400Regular
- Manrope_500Medium
- Manrope_600SemiBold
- Manrope_700Bold

### Text styles
- `h1`: Outfit_700Bold, 32px, letterSpacing -0.5, `textPrimary`
- `h2`: Outfit_700Bold, 24px, letterSpacing -0.3, `textPrimary`
- `h3`: Outfit_600SemiBold, 18px, `textPrimary`
- `body`: Manrope_500Medium, 15px, `textPrimary`
- `small`: Manrope_400Regular, 13px, `textSecondary`
- `tiny`: Manrope_600SemiBold, 11px, uppercase, letterSpacing 1.2, `textMuted`
- `button`: Outfit_600SemiBold, 16px, `#fff`

## Spacing Scale

- `xs`: 4
- `s`: 8
- `m`: 16
- `l`: 24
- `xl`: 32
- `xxl`: 48

## Corner Radius

- `sm`: 10
- `md`: 16
- `lg`: 22
- `xl`: 28
- `pill`: 999

## Shadows

- `shadow.card`
  - color: #1E3A8A
  - offset: 0, 10
  - opacity: 0.08
  - radius: 24
  - elevation: 6

- `shadow.soft`
  - color: #0F172A
  - offset: 0, 4
  - opacity: 0.06
  - radius: 12
  - elevation: 3

- `shadow.strong`
  - color: #1D4ED8
  - offset: 0, 12
  - opacity: 0.35
  - radius: 20
  - elevation: 12

## Core UI Patterns

### Backgrounds
- Use `bg` (#F5F8FF) as the main screen background.
- Use light gradients and soft gradients for hero sections and header areas.
- Use `surface` (#FFFFFF) for cards and elevated panels.

### Glassmorphism
- `GlassCard` component is a translucent, blurred card with:
  - background: `glass`
  - border: `glassBorder`
  - borderRadius: `xl`
  - soft shadow
  - padding: 18

### Buttons
- Primary buttons use `GradientButton` with full-width pill shape and `gradients.primary`.
- Button text uses `typography.button` with white text.
- Disabled buttons use gray gradient fallback: `#CBD5E1` to `#94A3B8`.

### Cards and Panels
- Most card surfaces are white or glass-style with rounded corners and subtle shadows.
- Section cards often use `radii.xl` or `radii.lg`.
- Important action cards use gradient overlays and bold icon accents.

### Headers and Section Titles
- `SectionTitle`: row layout with title on left and optional action text on right.
- `ScreenHeader`: centered heading with optional left back button and right action slot.
- Header titles use `typography.h3`.

### Progress and Status
- `ProgressRing` is the standard circular progress indicator with rounded stroke cap.
- Primary ring color is `primaryLight` (#3B82F6) and track color is `#E2E8F0`.
- Use subtle success and danger backgrounds for status chips: `successBg`, `danger`.

### Navigation Bar
- Bottom tab bar uses blurred glass surface and pill-style tab buttons.
- Active tab icons use solid color and inactive tabs use secondary text color.
- Tab container is rounded and elevated with blur.

## Design Rules

- Maintain cool blue-first palette with gold and flame accents.
- Use bold headings with Outfit and calmer body text with Manrope.
- Prefer soft rounded corners and layered translucent surfaces.
- Keep highest contrast on primary calls to action using vivid blue gradients.
- Use white or very light blue background for content cards.
- Use `textPrimary` for primary copy and `textSecondary`/`textMuted` for labels and helper text.

## Common Component Usage

- `LinearGradient`:
  - `gradients.primary` for CTAs and emphasis.
  - `gradients.premium` for premium headers and dark hero areas.
  - Light gradient pairs for background fills: `#EFF6FF` → `bg`, `#F5F3FF` → `bg`, `#FFFBEB` → `bg`.

- `Ionicons` icons:
  - Used as supporting brand and UI icons with `primary` or white color.
  - Common icon sizes range from 16 to 44.

- `TextInput` and input containers:
  - Use rounded corners, soft borders, and primary accent outlines.
  - Phone inputs, OTP entry, and referral fields follow the same rounded, elevated card styling.

## Notes for AI Agents

- Ye design system project ke core visual language ko capture karta hai.
- Agar naye page ya component banana ho, to `colors`, `gradients`, `typography`, `radii`, `spacing`, aur `shadows` ko reuse karo.
- Primary UI identity hai: deep blue gradient branding + white/glass surfaces + simple bold headings.
- `Outfit` headline + `Manrope` body font combination se consistent UX ensure hota hai.
