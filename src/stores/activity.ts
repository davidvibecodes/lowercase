import { create } from "zustand";

/** What the user is in the middle of, so global prompts can respect it (U5). */
type ActivityState = {
  lessonInProgress: boolean;
  activeSessionId: string | null;
  setLessonInProgress: (v: boolean) => void;
  setActiveSession: (id: string | null) => void;
};

export const useActivity = create<ActivityState>((set) => ({
  lessonInProgress: false,
  activeSessionId: null,
  setLessonInProgress: (lessonInProgress) => set({ lessonInProgress }),
  setActiveSession: (activeSessionId) => set({ activeSessionId }),
}));
