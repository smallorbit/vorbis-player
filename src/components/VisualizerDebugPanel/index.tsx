import React, { useState, useCallback } from 'react';
import { useVisualizerDebug } from '@/contexts/VisualizerDebugContext';
import {
  Panel,
  Title,
  Section,
  SectionHeader,
  ParamRow,
  ParamLabel,
  SliderInput,
  NumberInput,
  ButtonRow,
  Button,
  JsonArea,
} from './styled';

function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseFloat(e.target.value);
      if (!Number.isNaN(v)) onChange(v);
    },
    [onChange]
  );
  return (
    <ParamRow>
      <ParamLabel>{label}</ParamLabel>
      <SliderInput value={value} min={min} max={max} step={step} onChange={handleChange} />
      <NumberInput value={value} min={min} max={max} step={step} onChange={handleChange} />
    </ParamRow>
  );
}

function ParamNumber({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseFloat(e.target.value);
      if (!Number.isNaN(v)) onChange(v);
    },
    [onChange]
  );
  return (
    <ParamRow>
      <ParamLabel>{label}</ParamLabel>
      <NumberInput
        value={value}
        min={min}
        max={max}
        step={step ?? 0.01}
        onChange={handleChange}
      />
    </ParamRow>
  );
}

export function VisualizerDebugPanel() {
  const ctx = useVisualizerDebug();
  const [loadJson, setLoadJson] = useState('');
  const [loadStatus, setLoadStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const [particleOpen, setParticleOpen] = useState(true);
  const [trailOpen, setTrailOpen] = useState(true);

  const handleDownload = useCallback(() => {
    if (!ctx) return;
    const blob = new Blob([ctx.exportAsJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'vorbis-visualizer-config.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }, [ctx]);

  const handleLoad = useCallback(() => {
    if (!ctx) return;
    const ok = ctx.loadOverridesFromJson(loadJson);
    setLoadStatus(ok ? 'ok' : 'err');
  }, [ctx, loadJson]);

  if (!ctx?.isDebugMode) return null;

  const { config, setParticleOverride, setTrailOverride, reset, copyExportToClipboard } = ctx;
  const p = config.particle;
  const t = config.trail;

  return (
    <Panel>
      <Title>Visualizer debug (?debug=visualizer)</Title>

      <Section>
        <SectionHeader type="button" onClick={() => setParticleOpen((o) => !o)}>
          Fireflies (Particle) {particleOpen ? '▼' : '▶'}
        </SectionHeader>
        {particleOpen && (
          <>
            <ParamSlider label="minRadius" value={p.minRadius} min={0.5} max={8} step={0.5} onChange={(v) => setParticleOverride('minRadius', v)} />
            <ParamSlider label="maxRadius" value={p.maxRadius} min={2} max={24} step={0.5} onChange={(v) => setParticleOverride('maxRadius', v)} />
            <ParamSlider label="speedRange" value={p.speedRange} min={0.1} max={2} step={0.05} onChange={(v) => setParticleOverride('speedRange', v)} />
            <ParamSlider label="opacityBase" value={p.opacityBase} min={0} max={1} step={0.05} onChange={(v) => setParticleOverride('opacityBase', v)} />
            <ParamSlider label="opacitySpread" value={p.opacitySpread} min={0} max={1} step={0.05} onChange={(v) => setParticleOverride('opacitySpread', v)} />
            <ParamSlider label="pulseVariation" value={p.pulseVariation} min={0} max={12} step={0.5} onChange={(v) => setParticleOverride('pulseVariation', v)} />
            <ParamSlider label="pausedSpeed" value={p.pausedSpeed} min={0} max={1} step={0.05} onChange={(v) => setParticleOverride('pausedSpeed', v)} />
            <ParamSlider label="speedMultiplier" value={p.speedMultiplier} min={0.5} max={2} step={0.05} onChange={(v) => setParticleOverride('speedMultiplier', v)} />
            <ParamNumber label="countBaseMobile" value={p.countBaseMobile} min={10} max={200} step={5} onChange={(v) => setParticleOverride('countBaseMobile', v)} />
            <ParamNumber label="countBaseDesktop" value={p.countBaseDesktop} min={20} max={300} step={5} onChange={(v) => setParticleOverride('countBaseDesktop', v)} />
            <ParamNumber label="countPixelDivisor" value={p.countPixelDivisor} min={2000} max={15000} step={500} onChange={(v) => setParticleOverride('countPixelDivisor', v)} />
            <ParamNumber label="countPixelDivisorMobile" value={p.countPixelDivisorMobile} min={4000} max={20000} step={500} onChange={(v) => setParticleOverride('countPixelDivisorMobile', v)} />
          </>
        )}
      </Section>

      <Section>
        <SectionHeader type="button" onClick={() => setTrailOpen((o) => !o)}>
          Comet (Trail) {trailOpen ? '▼' : '▶'}
        </SectionHeader>
        {trailOpen && (
          <>
            <ParamSlider label="particleMinRadius" value={t.particleMinRadius} min={1} max={15} step={0.5} onChange={(v) => setTrailOverride('particleMinRadius', v)} />
            <ParamSlider label="particleMaxRadius" value={t.particleMaxRadius} min={5} max={40} step={0.5} onChange={(v) => setTrailOverride('particleMaxRadius', v)} />
            <ParamNumber label="lifeDrainDivisor" value={t.lifeDrainDivisor} min={5000} max={30000} step={500} onChange={(v) => setTrailOverride('lifeDrainDivisor', v)} />
            <ParamSlider label="shipTurnRate" value={t.shipTurnRate} min={0.00002} max={0.0005} step={0.00001} onChange={(v) => setTrailOverride('shipTurnRate', v)} />
            <ParamSlider label="shipSpeedBase" value={t.shipSpeedBase} min={0.5} max={6} step={0.1} onChange={(v) => setTrailOverride('shipSpeedBase', v)} />
            <ParamSlider label="shipSpeedSpread" value={t.shipSpeedSpread} min={0} max={2} step={0.1} onChange={(v) => setTrailOverride('shipSpeedSpread', v)} />
            <ParamSlider label="pausedSpeedMult" value={t.pausedSpeedMult} min={0} max={0.5} step={0.01} onChange={(v) => setTrailOverride('pausedSpeedMult', v)} />
            <ParamSlider label="oppositeMult" value={t.oppositeMult} min={0} max={1} step={0.05} onChange={(v) => setTrailOverride('oppositeMult', v)} />
            <ParamSlider label="perpSpread" value={t.perpSpread} min={0} max={5} step={0.1} onChange={(v) => setTrailOverride('perpSpread', v)} />
            <ParamSlider label="particleSpeedMult" value={t.particleSpeedMult} min={0.5} max={2} step={0.05} onChange={(v) => setTrailOverride('particleSpeedMult', v)} />
            <ParamSlider label="glowRadius" value={t.glowRadius} min={0} max={80} step={2} onChange={(v) => setTrailOverride('glowRadius', v)} />
            <ParamSlider label="minVisibleRadius" value={t.minVisibleRadius} min={1} max={15} step={0.5} onChange={(v) => setTrailOverride('minVisibleRadius', v)} />
            <ParamNumber label="countBaseMobile" value={t.countBaseMobile} min={20} max={300} step={5} onChange={(v) => setTrailOverride('countBaseMobile', v)} />
            <ParamNumber label="countBaseDesktop" value={t.countBaseDesktop} min={50} max={300} step={5} onChange={(v) => setTrailOverride('countBaseDesktop', v)} />
            <ParamNumber label="countPixelDivisor" value={t.countPixelDivisor} min={2000} max={10000} step={500} onChange={(v) => setTrailOverride('countPixelDivisor', v)} />
            <ParamNumber label="countPixelDivisorMobile" value={t.countPixelDivisorMobile} min={4000} max={15000} step={500} onChange={(v) => setTrailOverride('countPixelDivisorMobile', v)} />
            <ParamNumber label="driftDecay" value={t.driftDecay} min={0.99} max={1} step={0.0001} onChange={(v) => setTrailOverride('driftDecay', v)} />
          </>
        )}
      </Section>

      <Section>
        <Title style={{ marginBottom: 4 }}>Export / Import</Title>
        <ButtonRow>
          <Button type="button" onClick={reset}>Reset to defaults</Button>
          <Button type="button" onClick={copyExportToClipboard}>Copy JSON</Button>
          <Button type="button" $variant="primary" onClick={handleDownload}>Download JSON</Button>
        </ButtonRow>
        <ParamLabel style={{ marginTop: 8, flex: 'none' }}>Load config from JSON</ParamLabel>
        <JsonArea
          placeholder='Paste exported JSON here…'
          value={loadJson}
          onChange={(e) => { setLoadJson(e.target.value); setLoadStatus('idle'); }}
        />
        <ButtonRow>
          <Button type="button" onClick={handleLoad}>Load</Button>
          {loadStatus === 'ok' && <span style={{ color: 'var(--success)' }}>Loaded.</span>}
          {loadStatus === 'err' && <span style={{ color: 'var(--error)' }}>Invalid JSON.</span>}
        </ButtonRow>
      </Section>
    </Panel>
  );
}
