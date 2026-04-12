# Speak Out Project Structure

```text
SpeakOut/
├─ app/
│  ├─ _layout.tsx
│  ├─ (app)/
│  │  ├─ _layout.tsx
│  │  ├─ practice/
│  │  ├─ history/
│  │  └─ report/
│  └─ modal/
├─ docs/
│  └─ project-structure.md
├─ src/
│  ├─ components/
│  │  ├─ charts/
│  │  └─ glass/
│  ├─ features/
│  │  ├─ history/
│  │  ├─ practice/
│  │  └─ report/
│  ├─ hooks/
│  ├─ lib/
│  ├─ services/
│  │  ├─ audio/
│  │  └─ camera/
│  ├─ store/
│  │  └─ store.ts
│  └─ types/
│     └─ types.ts
└─ assets/
```

## Notes

- `app/` uses Expo Router file-based routing and only contains navigation shells for now.
- `src/store/store.ts` centralizes recording workflow state, live coaching content, history records, and report mocks.
- `src/types/types.ts` contains shared domain models for scenes, transcripts, history cards, and the final report payload.
- `src/services/audio` and `src/services/camera` are reserved for future `expo-av` and `expo-camera` integration.
