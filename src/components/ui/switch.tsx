import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"
import { cn } from "@/lib/utils"

// Per-part style escape hatches — mirrors slider.tsx pattern.
//
// variant="accent" (default): checked track = var(--accent-color).
//   Player-chrome surfaces (QuickEffectsRow glow/visualizer/translucence).
//
// variant="neutral": checked track = shadcn --primary (near-white, static).
//   Settings-panel toggles (SourcesSections, LibraryProviderBar, ProviderSetupScreen).
//
// trackStyle / thumbStyle: escape hatches for dimensions or one-off overrides.
//   For checked-state colour overrides use className="data-[state=checked]:bg-[...]"
//   instead — inline trackStyle applies unconditionally to both states.
//
// State-aware thumb colours: app background is 5% lightness (near-black). bg-background
// for the thumb (shadcn default) gives a dark thumb on a dark unchecked track — near-zero
// contrast. Flip: light thumb when unchecked (dark track), dark thumb when checked
// (light/accent track).

export type SwitchVariant = 'accent' | 'neutral'

export type SwitchProps = React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> & {
  variant?: SwitchVariant
  trackStyle?: React.CSSProperties
  thumbStyle?: React.CSSProperties
}

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SwitchProps
>(({ className, variant = 'accent', trackStyle, thumbStyle, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full",
      "border-2 border-transparent outline-none",
      "transition-colors duration-200",
      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:cursor-not-allowed disabled:opacity-40",
      variant === 'accent'
        ? "data-[state=checked]:bg-[var(--accent-color)] data-[state=unchecked]:bg-input/40"
        : "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className
    )}
    style={trackStyle}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full shadow-sm ring-0 transition-transform duration-200",
        "data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
        "data-[state=checked]:bg-background data-[state=unchecked]:bg-foreground"
      )}
      style={thumbStyle}
    />
  </SwitchPrimitive.Root>
))
Switch.displayName = SwitchPrimitive.Root.displayName
