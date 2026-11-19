import { RWANDA_LOCATIONS, PROVINCES } from "../data/rwandaLocations";

/**
 * Rwanda's districts a rider delivers in: chosen ones as removable chips,
 * more added from a list grouped by province. `value` is an array of names.
 */
export default function DistrictsPicker({ value = [], onChange, label = "Districts you deliver in" }) {
  const add = (d) => { if (d && !value.includes(d)) onChange([...value, d]); };
  const remove = (d) => onChange(value.filter((x) => x !== d));
  return (
    <div className="field districts-picker">
      <span>{label}</span>
      {value.length > 0 && (
        <ul className="district-chips">
          {value.map((d) => (
            <li key={d}><span>{d}</span><button type="button" aria-label={`Remove ${d}`} onClick={() => remove(d)}>×</button></li>
          ))}
        </ul>
      )}
      <select value="" onChange={(e) => add(e.target.value)} aria-label="Add a district">
        <option value="">{value.length ? "Add another district" : "Choose a district"}</option>
        {PROVINCES.map((p) => (
          <optgroup key={p} label={p}>
            {RWANDA_LOCATIONS[p].filter((d) => !value.includes(d)).map((d) => <option key={d} value={d}>{d}</option>)}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
