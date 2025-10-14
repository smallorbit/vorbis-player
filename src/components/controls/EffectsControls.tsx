import { memo } from 'react';
import { ControlButton } from './styled';

interface EffectsControlsProps {
    glowEnabled?: boolean;
    onGlowToggle?: () => void;
    showVisualEffects?: boolean;
    onShowVisualEffects?: () => void;
    accentColor: string;
    isMobile: boolean;
    isTablet: boolean;
}

// Custom comparison function for memo optimization
const areEffectsControlsPropsEqual = (
    prevProps: EffectsControlsProps,
    nextProps: EffectsControlsProps
): boolean => {
    return (
        prevProps.glowEnabled === nextProps.glowEnabled &&
        prevProps.showVisualEffects === nextProps.showVisualEffects &&
        prevProps.accentColor === nextProps.accentColor &&
        prevProps.isMobile === nextProps.isMobile &&
        prevProps.isTablet === nextProps.isTablet
        // Callbacks are excluded as they should be memoized by parent
    );
};

export const EffectsControls = memo<EffectsControlsProps>(({
    glowEnabled,
    onGlowToggle,
    showVisualEffects,
    onShowVisualEffects,
    accentColor,
    isMobile,
    isTablet
}) => {
    return (
        <>
            {onGlowToggle && (
                <ControlButton
                    $isMobile={isMobile}
                    $isTablet={isTablet}
                    accentColor={accentColor}
                    isActive={glowEnabled}
                    title={`Visual Effects ${glowEnabled ? 'enabled' : 'disabled'} `}
                    onClick={onGlowToggle}
                    style={{ marginLeft: 8 }}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="9" />
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 3v4m0 10v4m9-9h-4m-10 0H3" />
                    </svg>
                </ControlButton>
            )}
            <ControlButton
                $isMobile={isMobile}
                $isTablet={isTablet}
                accentColor={accentColor}
                onClick={onShowVisualEffects}
                isActive={showVisualEffects}
                title="Visual effects"
                data-testid="visual-effects-button"
            >
                <svg viewBox="0 0 24 24" style={{ display: 'block' }} width="1.5rem" height="1.5rem" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                        fill="currentColor"
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.07-.98l2.11-1.65a.5.5 0 00.12-.64l-2-3.46a.5.5 0 00-.6-.22l-2.49 1a7.03 7.03 0 00-1.7-.98l-.38-2.65A.488.488 0 0014 2h-4a.488.488 0 00-.5.42l-.38 2.65c-.63.25-1.21.57-1.77.98l-2.49-1a.5.5 0 00-.6.22l-2 3.46a.5.5 0 00.12.64l2.11 1.65c-.05.32-.08.65-.08.99s.03.67.08.99l-2.11 1.65a.5.5 0 00-.12.64l2 3.46c.14.24.44.33.7.22l2.49-1c.54.41 1.13.74 1.77.98l.38 2.65c.05.28.27.42.5.42h4c.23 0 .45-.14.5-.42l.38-2.65c.63-.25 1.22-.57 1.77-.98l2.49 1c.26.11.56.02.7-.22l2-3.46a.5.5 0 00-.12-.64l-2.11-1.65zM12 15.5A3.5 3.5 0 1112 8.5a3.5 3.5 0 010 7z"
                    />
                    <circle cx="12" cy="12" r="2" fill="#fff" />
                </svg>
            </ControlButton>
        </>
    );
}, areEffectsControlsPropsEqual);

EffectsControls.displayName = 'EffectsControls';

export default EffectsControls;
