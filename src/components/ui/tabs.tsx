import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

// Tabs primitive — neutral shadcn palette.
// Do NOT wire --primary or --accent to var(--accent-color).
//
// Per-part style escape hatches:
//   listStyle  → TabsList root element
//   triggerStyle → each TabsTrigger (pass via the trigger directly or via the list)
//   contentStyle → TabsContent panel

const Tabs = TabsPrimitive.Root

type TabsListProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
  listStyle?: React.CSSProperties
}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, listStyle, style, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
      className
    )}
    style={{ ...listStyle, ...style }}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

type TabsTriggerProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
  triggerStyle?: React.CSSProperties
}

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, triggerStyle, style, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background",
      "transition-all duration-150",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
      "motion-reduce:transition-none",
      className
    )}
    style={{ ...triggerStyle, ...style }}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

type TabsContentProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content> & {
  contentStyle?: React.CSSProperties
}

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  TabsContentProps
>(({ className, contentStyle, style, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    style={{ ...contentStyle, ...style }}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
