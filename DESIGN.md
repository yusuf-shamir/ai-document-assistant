# Design system

The interface uses a small custom CSS system in `src/app/globals.css`. It does not depend on a full component library. React components own behavior and semantic markup; CSS custom properties and class variants provide visual consistency. Lucide React supplies icons.

## Color tokens

| Token | Light value | Use |
| --- | --- | --- |
| `--bg` | `#f8f8f6` | Main app background |
| `--surface` | `#ffffff` | Sidebar, cards, dialogs, and controls |
| `--surface-soft` | `#f3f3f0` | Secondary panels and hover surfaces |
| `--ink` | `#262923` | Primary text |
| `--ink-soft` | `#676c63` | Secondary text |
| `--muted` | `#6b7067` | Supporting labels |
| `--line` | `#e9eae5` | Borders and dividers |
| `--accent` | `#53735b` | Primary actions and focus accents |
| `--accent-dark` | `#3f5c46` | Hover and emphasized accent |
| `--accent-pale` | `#e8eee8` | Subtle accent backgrounds |
| `--danger` | `#b2544a` | Error and destructive actions |

Dark mode replaces these values under `html[data-theme="dark"]` with deep green-gray surfaces, light text, pale green accents, and a lighter danger color. The theme toggle persists its value in localStorage and initializes from the system preference when no saved preference exists.

## Typography scale

| Token / role | Size |
| --- | --- |
| `--text-caption` | 12 px |
| `--text-body` | 14 px |
| `--text-title` | 20 px |
| `--text-display` | `clamp(28px, 3.5vw, 40px)` |
| Small metadata | 9–11 px |
| Message body | 12–13 px depending on viewport |

The base UI uses Arial/Helvetica with system fallbacks. Headings use compact weights and negative tracking to maintain hierarchy in the narrow workspace.

## Spacing and shape

Spacing tokens: `--space-1: 4px`, `--space-2: 8px`, `--space-3: 12px`, `--space-4: 16px`, `--space-6: 24px`, `--space-8: 32px`. Workspace gutters use `clamp(16px, 3vw, 28px)` and composer bottom padding adapts to viewport height plus the mobile safe-area inset.

Shape tokens: `--radius-small: 7px`, `--radius-control: 9px`, and `--radius-panel: 12px`. Larger dialogs use a 15–16 px radius.

## Component variants

- **Buttons:** `.button`, `.button-primary`, `.button-subtle`, `.button-danger`, and `.icon-button` cover primary, secondary, destructive, and icon-only actions. Disabled and focus states are explicit.
- **Documents:** `.document-row`, `.file-mark-pdf`, and status classes distinguish file type and ready/uploading/error states.
- **Messages:** `.message-user` and `.message-assistant` differentiate speaker; markdown citations have a clear accent background and hover/focus treatment.
- **Dialogs:** PDF and confirmation overlays use a dimmed backdrop, bounded content, and responsive full-screen behavior on mobile.
- **Themes:** semantic tokens support the same components in light and dark modes.

## Responsive behavior

The workspace uses a fixed viewport shell with internal scroll regions. The navigation panel becomes a keyboard-operable drawer at widths up to 680 px. Message and composer gutters shrink at mobile sizes. PDF and confirmation dialogs fit the viewport, including narrow screens; responsive layout checks cover 320, 390, 681, 900, and 1440 px widths.

## Accessibility decisions

- Native buttons, file inputs, checkboxes, labels, and textarea are used for interaction.
- Icon-only controls have accessible names; status and streaming text use live/status semantics where appropriate.
- `:focus-visible` provides a 3 px accent outline for buttons, inputs, and links.
- The mobile drawer and dialogs expose dialog semantics, have escape handling, and manage focus. The app content is inert while a modal PDF or confirmation dialog is open.
- Reduced-motion preferences shorten animations and transitions.
- Contrast and keyboard access are designed with WCAG 2.1 AA in mind, but the current axe check covers only the message component. This is not a claim of a complete WCAG audit; full-page automated and manual checks remain a gap.
