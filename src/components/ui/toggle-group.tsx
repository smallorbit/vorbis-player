import * as React from "react"
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group"

import { cn } from "@/lib/utils"

// ToggleGroup primitive — replaces the legacy styled-components `OptionButton`
// (formerly src/components/AppSettingsMenu/styled.ts). Radix gives roving-tabindex
// keyboard navigation and single-selection semantics for free.
//
// variant (mirrors src/components/ui/switch.tsx):
//   "accent"  → active item = var(--accent-color) / var(--accent-contrast-color).
//               Flip-menu chrome (controls/QuickEffectsRow) that retints with the
//               playing track.
//   "neutral" → active item = shadcn --primary (static near-white). Settings
//               surfaces (AppSettingsMenu drawer, SettingsV2). Default.
//
// Per-part style escape hatches:
//   rootStyle → ToggleGroup.Root element
//   itemStyle → each ToggleGroup.Item button

export type ToggleGroupVariant = "accent" | "neutral"

type ToggleGroupContextValue = {
  variant: ToggleGroupVariant
  itemStyle?: React.CSSProperties | undefined
}

const ToggleGroupContext = React.createContext<ToggleGroupContextValue>({
  variant: "neutral",
})

type ToggleGroupProps = React.ComponentPropsWithoutRef<
  typeof ToggleGroupPrimitive.Root
> & {
  variant?: ToggleGroupVariant | undefined
  rootStyle?: React.CSSProperties | undefined
  itemStyle?: React.CSSProperties | undefined
}

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  ToggleGroupProps
>(
  (
    { className, variant = "neutral", rootStyle, itemStyle, style, children, ...props },
    ref,
  ) => (
    <ToggleGroupPrimitive.Root
      ref={ref}
      className={cn("flex flex-wrap items-center gap-2", className)}
      style={{ ...rootStyle, ...style }}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, itemStyle }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  ),
)
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName

type ToggleGroupItemProps = React.ComponentPropsWithoutRef<
  typeof ToggleGroupPrimitive.Item
> & {
  itemStyle?: React.CSSProperties | undefined
}

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  ToggleGroupItemProps
>(({ className, itemStyle, style, children, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext)
  const accent = context.variant === "accent"

  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        "min-w-[60px] cursor-pointer rounded-sm border px-3 py-1.5 text-xs font-medium",
        "transition-all duration-150 ease-out",
        "border-border bg-muted text-muted-foreground",
        "hover:border-ring hover:bg-muted hover:text-foreground hover:-translate-y-px",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        accent
          ? [
              "data-[state=on]:border-[var(--accent-color)] data-[state=on]:bg-[var(--accent-color)] data-[state=on]:text-[var(--accent-contrast-color)]",
              "data-[state=on]:hover:border-[var(--accent-color)] data-[state=on]:hover:bg-[color-mix(in_srgb,var(--accent-color)_87%,transparent)] data-[state=on]:hover:text-[var(--accent-contrast-color)]",
            ]
          : [
              "data-[state=on]:border-[hsl(var(--primary))] data-[state=on]:bg-[hsl(var(--primary))] data-[state=on]:text-[hsl(var(--primary-foreground))]",
              "data-[state=on]:hover:border-[hsl(var(--primary))] data-[state=on]:hover:bg-[hsl(var(--primary)/0.87)] data-[state=on]:hover:text-[hsl(var(--primary-foreground))]",
            ],
        className,
      )}
      style={{ ...context.itemStyle, ...itemStyle, ...style }}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
})
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName

export { ToggleGroup, ToggleGroupItem }
