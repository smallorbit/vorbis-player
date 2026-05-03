import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/lib/utils"

// ScrollArea primitive — neutral shadcn palette.
// Do NOT wire --primary or --accent to var(--accent-color).
//
// Per-part style escape hatches:
//   viewportStyle  → ScrollArea viewport (inner scrollable region)
//   scrollbarStyle → the scrollbar track element
//   thumbStyle     → the scrollbar thumb

type ScrollAreaProps = React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
  viewportStyle?: React.CSSProperties
  scrollbarStyle?: React.CSSProperties
  thumbStyle?: React.CSSProperties
}

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  ScrollAreaProps
>(({ className, viewportStyle, scrollbarStyle, thumbStyle, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport
      className="h-full w-full rounded-[inherit]"
      style={viewportStyle}
    >
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar scrollbarStyle={scrollbarStyle} thumbStyle={thumbStyle} />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

type ScrollBarProps = React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar> & {
  scrollbarStyle?: React.CSSProperties
  thumbStyle?: React.CSSProperties
}

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  ScrollBarProps
>(({ className, orientation = "vertical", scrollbarStyle, thumbStyle, style, ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors duration-150",
      "motion-reduce:transition-none",
      orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className
    )}
    style={{ ...scrollbarStyle, ...style }}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb
      className="relative flex-1 rounded-full bg-border"
      style={thumbStyle}
    />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
