# Roast Profile JSON Schema

This guide explains the fields used in `.json` profile files for the Gene Cafe Roast Helper.

## Top Level Fields
- **`name`** (string): The display name of the roast profile (e.g. "Ethiopian Natural").
- **`author`** (string, optional): The creator of the profile.
- **`description`** (string, optional): Notes about what this profile is designed for.
- **`beanInfo`** (object, optional): Metadata about the coffee.
  - `origin`, `process`, `cropYear`, `targetRoastLevel`, `batchSizeG`.
- **`roasterSettings`** (object, optional): Helper metadata for the roaster.
  - `preheatTempC`, `geneStartTimeMin`, `batchSizeG`.

## `points`
An array of temperature setpoints defining the curve. The app interpolates between these points.
- **`tS`** (number): Time in seconds from the start of the roast. (e.g. `300` = 5:00 minutes).
- **`tempC`** (number): The target "Set Temperature" (°C) at that exact time.

## `events`
An array of notifications that will pop up during the roast.
- **`tS`** (number): Time in seconds when the event should trigger.
- **`label`** (string): Short title (e.g. "Turn Heat Up").
- **`instruction`** (string): Detailed text shown to the user (e.g. "Crank the knob to 235C now!").
- **`requireAck`** (boolean): If `true`, the user must click "OK" to dismiss. If `false`, it might be transient (though currently all events use the same modal).

## Example Snippet
```json
{
  "name": "Quick Roast",
  "points": [
    { "tS": 0, "tempC": 150 },
    { "tS": 600, "tempC": 235 }
  ]
}
```
