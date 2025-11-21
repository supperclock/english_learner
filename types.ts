export enum AppMode {
  IDLE = 'IDLE',
  ASSESSMENT = 'ASSESSMENT',
  PRACTICE = 'PRACTICE',
  GENERATING_PLAN = 'GENERATING_PLAN'
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  objective: string;
}

export interface UserPlan {
  level: string;
  feedback: string;
  scenarios: Scenario[];
}

export interface LiveSessionConfig {
  systemInstruction: string;
  voiceName: string;
}
