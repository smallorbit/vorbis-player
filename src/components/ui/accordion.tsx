import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"

import { cn } from "@/lib/utils"
import { ChevronDownIcon } from "@/components/icons/ActionIcons"

// Accordion primitives — neutral shadcn palette.
// Do NOT wire --primary or --accent to var(--accent-color).
//
// Standalone collapsibles (each Accordion.Root wraps a single item),
// not a grouped accordion. type="single" collapsible toggles the item without
// requiring another to open. Separate Root per section preserves CollapsibleSection's
// independent open/close state — a shared Root with type="single" would auto-close
// all others when one opens.

const Accordion = AccordionPrimitive.Root

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item ref={ref} className={cn("", className)} {...props} />
))
AccordionItem.displayName = "AccordionItem"

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between",
        "w-full bg-transparent border-0 p-0 cursor-pointer",
        "text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground",
        "transition-colors hover:text-foreground",
        "mb-6",
        "[&>svg]:transition-transform [&>svg]:duration-200",
        "[&[data-state=open]>svg]:rotate-180",
        "motion-reduce:[&>svg]:transition-none",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon className="h-3.5 w-3.5 shrink-0" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
))
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className={cn(
      "overflow-hidden text-sm",
      "data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up",
      "motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none",
    )}
    {...props}
  >
    {/* Inner div required so overflow:hidden on Content doesn't clip padding */}
    <div className={cn("pb-4", className)}>{children}</div>
  </AccordionPrimitive.Content>
))
AccordionContent.displayName = AccordionPrimitive.Content.displayName

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
