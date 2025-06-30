// Re-export our styled Button component to maintain compatibility
export { Button } from '../styled/Button';

// Add buttonVariants function for compatibility with shadcn components
export const buttonVariants = (props?: { variant?: string }) => {
  const { variant = "default" } = props || {};
  
  // Return basic button classes - these are used by alert dialog
  const baseClasses = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2";
  
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground"
  };
  
  return `${baseClasses} ${variants[variant as keyof typeof variants] || variants.default}`;
};
