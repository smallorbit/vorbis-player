import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

/**
 * Per-part style escape hatches — required by `TimelineSlider`, which paints
 * the filled range and thumb with the runtime `var(--accent-color)` derived
 * from album art and overrides the default track height for responsive
 * sizing. Do not strip these as "unused": removing them re-forks the slider.
 *
 * Default Slider stays neutral (uses shadcn `--primary`); pass these props
 * only when you need accent tinting or custom dimensions.
 */
type SliderProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
  trackStyle?: React.CSSProperties
  rangeStyle?: React.CSSProperties
  thumbStyle?: React.CSSProperties
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, trackStyle, rangeStyle, thumbStyle, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track
      className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20"
      style={trackStyle}
    >
      <SliderPrimitive.Range
        className="absolute h-full bg-primary"
        style={rangeStyle}
      />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className="block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
      style={thumbStyle}
    />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
