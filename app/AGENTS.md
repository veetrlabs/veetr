# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

# Testing

This project uses **Jest 29** with the `react-native` preset.

## Config files

| File | Purpose |
|------|---------|
| `jest.config.cjs` | Jest configuration (preset, module mapping, transform ignore patterns) |
| `babel.config.cjs` | Babel config for transpilation (required by react-native preset) |

## Key patterns

- **Pure utilities** go in `src/utils/__tests__/` with no special mocking needed.
- **Context/reducer logic** is extracted and tested inline (see `src/context/__tests__/BLEContext.test.ts`).
- **Mocking `react-native`**: only mock what you need — don't `jest.requireActual` the full module.
- **Versions**: `"react": "19.2.6"` — do not pin to older 19.x. `"react-test-renderer"` uses `^19.1.0`.

## Adding tests

```bash
npm test              # run all tests
npm run test:watch    # watch mode
```

Place test files next to the source: `src/**/__tests__/*.test.ts`.
