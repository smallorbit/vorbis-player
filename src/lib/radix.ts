// Centralized Radix UI imports for better tree-shaking
// Import only the specific components needed

// Dialog
export {
  Root as DialogRoot,
  Trigger as DialogTrigger,
  Portal as DialogPortal,
  Overlay as DialogOverlay,
  Content as DialogContent,
  Title as DialogTitle,
  Description as DialogDescription,
  Close as DialogClose,
} from '@radix-ui/react-dialog';

// Slider
export {
  Root as SliderRoot,
  Track as SliderTrack,
  Range as SliderRange,
  Thumb as SliderThumb,
} from '@radix-ui/react-slider';

// Scroll Area
export {
  Root as ScrollAreaRoot,
  Viewport as ScrollAreaViewport,
  Scrollbar as ScrollAreaScrollbar,
  Thumb as ScrollAreaThumb,
  Corner as ScrollAreaCorner,
} from '@radix-ui/react-scroll-area';

// Tabs
export {
  Root as TabsRoot,
  List as TabsList,
  Trigger as TabsTrigger,
  Content as TabsContent,
} from '@radix-ui/react-tabs';

// Avatar
export {
  Root as AvatarRoot,
  Image as AvatarImage,
  Fallback as AvatarFallback,
} from '@radix-ui/react-avatar';

// Aspect Ratio
export { Root as AspectRatio } from '@radix-ui/react-aspect-ratio';

// Alert Dialog
export {
  Root as AlertDialogRoot,
  Trigger as AlertDialogTrigger,
  Portal as AlertDialogPortal,
  Overlay as AlertDialogOverlay,
  Content as AlertDialogContent,
  Title as AlertDialogTitle,
  Description as AlertDialogDescription,
  Action as AlertDialogAction,
  Cancel as AlertDialogCancel,
} from '@radix-ui/react-alert-dialog';

// Dropdown Menu
export {
  Root as DropdownMenuRoot,
  Trigger as DropdownMenuTrigger,
  Portal as DropdownMenuPortal,
  Content as DropdownMenuContent,
  Item as DropdownMenuItem,
  Group as DropdownMenuGroup,
  Label as DropdownMenuLabel,
  Separator as DropdownMenuSeparator,
  Sub as DropdownMenuSub,
  SubTrigger as DropdownMenuSubTrigger,
  SubContent as DropdownMenuSubContent,
} from '@radix-ui/react-dropdown-menu';

// Separator
export { Root as Separator } from '@radix-ui/react-separator';

// Slot
export { Slot } from '@radix-ui/react-slot';

// Toggle
export { Root as Toggle } from '@radix-ui/react-toggle';

// Toggle Group
export {
  Root as ToggleGroupRoot,
  Item as ToggleGroupItem,
} from '@radix-ui/react-toggle-group';

// Checkbox
export {
  Root as CheckboxRoot,
  Indicator as CheckboxIndicator,
} from '@radix-ui/react-checkbox';