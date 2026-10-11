import type { CSSProperties } from "react";
import { AppShell } from "@/components/app-shell";
import { Dashboard } from "@/components/dashboard";

/**
 * Demo mount for the @efferd/dashboard-3 registry block.
 *
 * AIStore's global palette re-assigns shadcn surface tokens (--card, --accent,
 * ...) to its dark 60/30/10 system, which would leave the block's cards with
 * dark text on dark surfaces. This wrapper re-scopes the standard shadcn light
 * theme to the block's subtree so it renders exactly as designed.
 *
 * Mount point for real usage: replace <Dashboard /> with your data-driven
 * composition, or drop <Dashboard /> pieces into an authenticated route.
 */
const shadcnLightTheme = {
	"--card": "oklch(1 0 0)",
	"--card-foreground": "oklch(0.145 0 0)",
	"--popover": "oklch(1 0 0)",
	"--popover-foreground": "oklch(0.145 0 0)",
	"--primary": "oklch(0.205 0 0)",
	"--primary-foreground": "oklch(0.985 0 0)",
	"--secondary": "oklch(0.97 0 0)",
	"--secondary-foreground": "oklch(0.205 0 0)",
	"--muted": "oklch(0.97 0 0)",
	"--muted-foreground": "oklch(0.556 0 0)",
	"--accent": "oklch(0.97 0 0)",
	"--accent-foreground": "oklch(0.205 0 0)",
	"--border": "oklch(0.922 0 0)",
	"--input": "oklch(0.922 0 0)",
	"--ring": "oklch(0.708 0 0)",
} as CSSProperties;

export function DashboardDemo() {
	return (
		<AppShell>
			<div style={shadcnLightTheme}>
				<Dashboard />
			</div>
		</AppShell>
	);
}
