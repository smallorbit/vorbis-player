# Task 1: Improve Styled Components Type Safety

## Objective
Enhance type safety and simplify prop handling for styled components, particularly addressing the complex prop filtering in LoadingCard and other styled components.

## Current Issues
- Complex `shouldForwardProp` filtering in LoadingCard (lines 50-51)
- Inconsistent prop typing across styled components
- Manual prop filtering that's error-prone and verbose
- Difficult to maintain as props change over time

## Current Problematic Code
```typescript
const LoadingCard = styled.div.withConfig({
  shouldForwardProp: (prop) => !['backgroundImage', 'standalone', 'accentColor', 'glowEnabled', 'glowIntensity', 'glowRate'].includes(prop),
}) <{
  backgroundImage?: string;
  standalone?: boolean;
  accentColor?: string;
  glowEnabled?: boolean;
  glowIntensity?: number;
  glowRate?: number;
}>`
```

## Files to Modify
- **Create**: `src/styles/styledUtils.ts`
- **Create**: `src/types/styledProps.ts`
- **Modify**: `src/components/AudioPlayer.tsx` (update LoadingCard)
- **Modify**: Other components with styled component prop issues

## Implementation Steps

### Step 1: Create Styled Component Utilities
Create `src/styles/styledUtils.ts`:

```typescript
import { css } from 'styled-components';

// Generic utility for creating shouldForwardProp functions
export const createForwardPropFilter = <T extends Record<string, any>>(
  propsToFilter: (keyof T)[]
) => {
  return (prop: string | number | symbol): boolean => {
    return !propsToFilter.includes(prop as keyof T);
  };
};

// Utility for creating typed styled components with filtered props
export const createStyledComponent = <
  TComponent extends keyof JSX.IntrinsicElements | React.ComponentType<any>,
  TProps extends Record<string, any>
>(
  component: TComponent,
  propsToFilter: (keyof TProps)[]
) => {
  return styled(component).withConfig({
    shouldForwardProp: createForwardPropFilter<TProps>(propsToFilter)
  });
};

// Common style mixins
export const glassMorphism = css`
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
`;

export const cardShadow = css`
  box-shadow:
    0 8px 24px rgba(38, 36, 37, 0.7),
    0 2px 8px rgba(22, 21, 21, 0.6);
`;

// Glow effect mixin
export const glowEffect = css<{ accentColor?: string; glowIntensity?: number }>`
  ${({ accentColor, glowIntensity }) =>
    accentColor && glowIntensity && glowIntensity > 0
      ? css`
          box-shadow:
            0 0 ${glowIntensity * 2}px ${accentColor}40,
            0 0 ${glowIntensity * 4}px ${accentColor}20,
            ${cardShadow};
        `
      : cardShadow}
`;
```

### Step 2: Create Type-Safe Prop Interfaces
Create `src/types/styledProps.ts`:

```typescript
// Base interface for common styled component props
export interface BaseStyledProps {
  className?: string;
  style?: React.CSSProperties;
}

// Card-specific props
export interface CardProps extends BaseStyledProps {
  accentColor?: string;
  backgroundImage?: string;
}

// Loading card specific props
export interface LoadingCardProps extends CardProps {
  standalone?: boolean;
  glowEnabled?: boolean;
  glowIntensity?: number;
  glowRate?: number;
}

// Container props
export interface ContainerProps extends BaseStyledProps {
  fullWidth?: boolean;
  centered?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

// Button props
export interface ButtonProps extends BaseStyledProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
}

// Type-safe prop filtering lists
export const LOADING_CARD_FILTERED_PROPS: (keyof LoadingCardProps)[] = [
  'backgroundImage',
  'standalone',
  'accentColor',
  'glowEnabled',
  'glowIntensity',
  'glowRate'
];

export const CONTAINER_FILTERED_PROPS: (keyof ContainerProps)[] = [
  'fullWidth',
  'centered',
  'padding'
];

export const BUTTON_FILTERED_PROPS: (keyof ButtonProps)[] = [
  'variant',
  'size',
  'disabled',
  'loading'
];
```

### Step 3: Update LoadingCard Component
Replace the current LoadingCard with type-safe version:

```typescript
import { createStyledComponent, glowEffect } from '../styles/styledUtils';
import { LoadingCardProps, LOADING_CARD_FILTERED_PROPS } from '../types/styledProps';
import { cardBase } from '../styles/utils';

const LoadingCard = createStyledComponent<'div', LoadingCardProps>(
  'div',
  LOADING_CARD_FILTERED_PROPS
)<LoadingCardProps>`
  ${cardBase};
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  border-radius: 1.25rem;
  border: 1px solid rgba(34, 36, 36, 0.68);
  ${glowEffect};

  ${({ backgroundImage }) => backgroundImage ? css`
    &::after {
      content: '';
      position: absolute;
      inset: 0.1rem;
      background-image: url(${backgroundImage});
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      border-radius: 1.25rem;
      z-index: 0;
    }
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: rgba(32, 30, 30, 0.7);
      backdrop-filter: blur(40px);
      border-radius: 1.25rem;
      z-index: 1;
    }
  ` : css`
    background: rgba(38, 38, 38, 0.5);
    backdrop-filter: blur(12px);
  `}
`;
```

### Step 4: Create Reusable Styled Component Factory
Create factory for common styled component patterns:

```typescript
// In styledUtils.ts
export const createCard = <TProps extends CardProps>(
  additionalProps: (keyof TProps)[] = []
) => {
  const filteredProps = [...LOADING_CARD_FILTERED_PROPS, ...additionalProps];

  return createStyledComponent<'div', TProps>('div', filteredProps)<TProps>`
    ${cardBase};
    border-radius: 1.25rem;
    border: 1px solid rgba(34, 36, 36, 0.68);
    ${glowEffect};

    ${({ backgroundImage }) => backgroundImage && css`
      background-image: url(${backgroundImage});
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
    `}
  `;
};

// Usage:
interface CustomCardProps extends CardProps {
  elevation?: number;
  rounded?: boolean;
}

const CustomCard = createCard<CustomCardProps>(['elevation', 'rounded'])`
  ${({ elevation = 1 }) => css`
    box-shadow: 0 ${elevation * 4}px ${elevation * 8}px rgba(0,0,0,0.1);
  `}

  ${({ rounded }) => rounded && css`
    border-radius: 50%;
  `}
`;
```

### Step 5: Create Type-Safe Theme Provider
Enhance theme typing for better IntelliSense:

```typescript
// In theme.ts
export interface ThemeInterface {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: {
      primary: string;
      secondary: string;
      disabled: string;
    };
    error: string;
    warning: string;
    success: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  breakpoints: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  typography: {
    fontFamily: string;
    fontSize: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
    };
    fontWeight: {
      normal: number;
      medium: number;
      semibold: number;
      bold: number;
    };
  };
}

// Extend styled-components DefaultTheme
declare module 'styled-components' {
  export interface DefaultTheme extends ThemeInterface {}
}
```

### Step 6: Create Component-Specific Styled Utilities
Create utilities for common component patterns:

```typescript
// Button utilities
export const createButton = <TProps extends ButtonProps>(
  additionalProps: (keyof TProps)[] = []
) => {
  const filteredProps = [...BUTTON_FILTERED_PROPS, ...additionalProps];

  return createStyledComponent<'button', TProps>('button', filteredProps)<TProps>`
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.2s ease;

    ${({ variant = 'primary', theme }) => {
      switch (variant) {
        case 'primary':
          return css`
            background: ${theme.colors.accent};
            color: white;
            &:hover { opacity: 0.9; }
          `;
        case 'secondary':
          return css`
            background: ${theme.colors.surface};
            color: ${theme.colors.text.primary};
            border: 1px solid ${theme.colors.accent};
            &:hover { background: ${theme.colors.accent}20; }
          `;
        case 'ghost':
          return css`
            background: transparent;
            color: ${theme.colors.text.secondary};
            &:hover { background: ${theme.colors.surface}; }
          `;
      }
    }}

    ${({ size = 'md', theme }) => {
      switch (size) {
        case 'sm':
          return css`
            padding: ${theme.spacing.xs} ${theme.spacing.sm};
            font-size: ${theme.typography.fontSize.sm};
          `;
        case 'md':
          return css`
            padding: ${theme.spacing.sm} ${theme.spacing.md};
            font-size: ${theme.typography.fontSize.md};
          `;
        case 'lg':
          return css`
            padding: ${theme.spacing.md} ${theme.spacing.lg};
            font-size: ${theme.typography.fontSize.lg};
          `;
      }
    }}

    ${({ disabled }) => disabled && css`
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    `}

    ${({ loading }) => loading && css`
      position: relative;
      color: transparent;

      &::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 1em;
        height: 1em;
        border: 2px solid currentColor;
        border-radius: 50%;
        border-top-color: transparent;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        to { transform: translate(-50%, -50%) rotate(360deg); }
      }
    `}
  `;
};
```

## Testing Requirements

### Unit Tests
- [ ] Prop filtering works correctly for all styled components
- [ ] Type safety prevents invalid prop combinations
- [ ] Theme integration works correctly
- [ ] Style mixins apply correctly
- [ ] Component factories create valid components

### Integration Tests
- [ ] Styled components integrate correctly with existing code
- [ ] Props pass through correctly to DOM elements
- [ ] Theme values are accessible in all components
- [ ] Performance is not impacted by type safety improvements

### Type Tests
- [ ] TypeScript compilation succeeds with strict mode
- [ ] IntelliSense provides correct prop suggestions
- [ ] Invalid prop combinations are caught at compile time
- [ ] Theme types are correctly inferred

### Manual Testing
- [ ] All styled components render correctly
- [ ] Props behave as expected
- [ ] Theme switching works correctly
- [ ] No runtime prop warnings in console

## Dependencies
- None (can be done independently of other tasks)

## Success Criteria
- [ ] Complex `shouldForwardProp` configurations simplified
- [ ] Type safety improved across all styled components
- [ ] Reusable styled component utilities created
- [ ] Theme typing enhanced
- [ ] All existing styling functionality preserved

## Implementation Benefits

### Before (Complex Prop Filtering)
```typescript
const LoadingCard = styled.div.withConfig({
  shouldForwardProp: (prop) => !['backgroundImage', 'standalone', 'accentColor', 'glowEnabled', 'glowIntensity', 'glowRate'].includes(prop),
}) <{
  backgroundImage?: string;
  standalone?: boolean;
  accentColor?: string;
  glowEnabled?: boolean;
  glowIntensity?: number;
  glowRate?: number;
}>`
```

### After (Type-Safe Factory)
```typescript
const LoadingCard = createStyledComponent<'div', LoadingCardProps>(
  'div',
  LOADING_CARD_FILTERED_PROPS
)<LoadingCardProps>`
```

## Advanced Features (Optional)
- **Style Debugging**: Add development-mode style debugging utilities
- **Performance Monitoring**: Monitor styled component render performance
- **Style Documentation**: Auto-generate style documentation from types
- **Theme Validation**: Runtime theme validation and fallbacks
- **Dynamic Styling**: Enhanced dynamic styling utilities

## Notes
- Test with React.StrictMode to catch prop warnings
- Consider using CSS-in-JS performance optimizations
- Ensure compatibility with styled-components version
- Test theme switching with all new styled components
- Consider migration strategy for existing styled components