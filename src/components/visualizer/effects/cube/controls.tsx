import { ValueLabel, Button, Label, Slider, Switch } from "../ui/controls";
import { useActions, useParams, usePresets } from "./reactive";

export default () => {
  const { nPerSide, cubeSpacingScalar, volume } = useParams();
  const { active: activePreset, options: presetOptions } = usePresets();
  const { setParams, setPreset } = useActions();

  return (
    <div className="flex w-full flex-col items-start justify-start gap-4">
      <Label>Cube Presets</Label>
      <div className="flex w-full items-center justify-start gap-2">
        {[...Object.keys(presetOptions), "custom"].map((p) => (
          <Button
            key={`po_${p}`}
            variant="ghost"
            aria-selected={activePreset === p}
            className="p-2 aria-selected:bg-primary/20"
            onClick={() => setPreset(p === "custom" ? undefined : p)}
          >
            {p}
          </Button>
        ))}
      </div>
      {!activePreset && (
        <>
          <ValueLabel label="N x Per Side" value={nPerSide} />
          <Slider
            value={[nPerSide]}
            min={3}
            max={20}
            step={1}
            onValueChange={(e) => setParams({ nPerSide: e[0] })}
          />
          <ValueLabel
            label="Cube Spacing"
            value={cubeSpacingScalar.toFixed(2)}
          />
          <Slider
            value={[cubeSpacingScalar]}
            min={0}
            max={0.5}
            step={0.1}
            onValueChange={(e) => setParams({ cubeSpacingScalar: e[0] })}
          />
          <div className="flex w-full items-center justify-between">
            <Label>Volume</Label>
            <Switch
              defaultChecked={volume}
              onCheckedChange={(e) => {
                setParams({ volume: e });
              }}
            />
          </div>
        </>
      )}
    </div>
  );
};