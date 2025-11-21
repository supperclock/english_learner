import React, { useState } from 'react';
import { BookOpen, BrainCircuit, ChevronRight, GraduationCap, LayoutDashboard, Loader2, Sparkles } from 'lucide-react';
import { LiveSession } from './components/LiveSession';
import { generateTrainingPlan } from './services/geminiService';
import { AppMode, LiveSessionConfig, Scenario, UserPlan } from './types';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.IDLE);
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null);
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  // Assessment Prompt
  const ASSESSMENT_CONFIG: LiveSessionConfig = {
    systemInstruction: `You are a friendly and professional English language examiner. 
    Your goal is to assess the user's English proficiency level (CEFR A1-C2) through a casual 2-minute conversation.
    Start by introducing yourself as "Sarah, your placement tutor" and ask a simple ice-breaker question (e.g., "Tell me a little about yourself").
    Gradually increase the complexity of your questions based on their responses. 
    Ask about their hobbies, work, or opinions on simple topics.
    Be encouraging but observant of grammar, vocabulary, and fluency.
    Keep your responses concise to allow the user to speak more.`,
    voiceName: 'Kore'
  };

  // Helper to create Practice Prompt
  const getPracticeConfig = (scenario: Scenario): LiveSessionConfig => ({
    systemInstruction: `You are a roleplay partner for an English learner.
    Scenario: ${scenario.title}
    Context: ${scenario.description}
    Your Goal: ${scenario.objective}
    Role: You are acting as a character in this scenario. Do not break character unless the user is completely stuck.
    Level Adjustment: The user is at a ${userPlan?.level || 'Intermediate'} level. Adjust your vocabulary speed accordingly.
    Correction Policy: Gently correct major grammatical errors by rephrasing what the user said correctly in your response, but prioritize conversation flow.
    Start the roleplay immediately with an opening line fitting the scenario.`,
    voiceName: 'Puck' // Different voice for variety
  });

  const handleSessionEnd = async (transcript: string) => {
    if (mode === AppMode.ASSESSMENT) {
      setMode(AppMode.GENERATING_PLAN);
      setIsGeneratingPlan(true);
      try {
        const plan = await generateTrainingPlan(transcript);
        setUserPlan(plan);
        setMode(AppMode.IDLE);
      } catch (error) {
        console.error(error);
        // Fallback for demo if API fails or transcript is empty
        setUserPlan({
          level: "B1 (Intermediate)",
          feedback: "You have good basic vocabulary but struggle with complex sentence structures. Focus on past tense consistency.",
          scenarios: [
            { id: "1", title: "Ordering Coffee", description: "You are at a busy cafe in London.", difficulty: "Beginner", objective: "Order a customized drink and ask for the price." },
            { id: "2", title: "Job Interview", description: "You are interviewing for a marketing role.", difficulty: "Intermediate", objective: "Describe your strengths and previous experience." },
            { id: "3", title: "Returning an Item", description: "You bought a defective laptop.", difficulty: "Advanced", objective: "Politely but firmly negotiate a refund without a receipt." }
          ]
        });
        setMode(AppMode.IDLE);
      } finally {
        setIsGeneratingPlan(false);
      }
    } else {
      // End of practice session
      setMode(AppMode.IDLE);
      setCurrentScenario(null);
    }
  };

  const startPractice = (scenario: Scenario) => {
    setCurrentScenario(scenario);
    setMode(AppMode.PRACTICE);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <Sparkles size={20} />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
              FluentFlow
            </h1>
          </div>
          <nav className="hidden md:flex gap-6 text-sm font-medium text-gray-600">
            <span className="hover:text-blue-600 cursor-pointer">Dashboard</span>
            <span className="hover:text-blue-600 cursor-pointer">Progress</span>
            <span className="hover:text-blue-600 cursor-pointer">Settings</span>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        
        {/* MODE: ACTIVE SESSION (Assessment or Practice) */}
        {(mode === AppMode.ASSESSMENT || mode === AppMode.PRACTICE) && (
          <div className="max-w-2xl mx-auto">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold text-gray-900">
                {mode === AppMode.ASSESSMENT ? "Level Assessment" : currentScenario?.title}
              </h2>
              <p className="text-gray-500 mt-2">
                {mode === AppMode.ASSESSMENT 
                  ? "Chat naturally with Sarah to evaluate your English skills." 
                  : currentScenario?.description}
              </p>
            </div>
            <div className="h-[60vh]">
              <LiveSession 
                config={mode === AppMode.ASSESSMENT ? ASSESSMENT_CONFIG : getPracticeConfig(currentScenario!)} 
                onEndSession={handleSessionEnd} 
              />
            </div>
          </div>
        )}

        {/* MODE: GENERATING PLAN */}
        {mode === AppMode.GENERATING_PLAN && (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
            <h2 className="text-2xl font-bold text-gray-900">Analyzing your conversation...</h2>
            <p className="text-gray-500 mt-2">Our AI is identifying your level and crafting a personalized plan.</p>
          </div>
        )}

        {/* MODE: IDLE (Dashboard) */}
        {mode === AppMode.IDLE && (
          <div className="space-y-8">
            
            {/* Hero / Welcome */}
            {!userPlan && (
              <div className="bg-gradient-to-r from-blue-600 to-purple-700 rounded-2xl p-8 md:p-12 text-white text-center shadow-xl">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">Master English with Real Conversations</h2>
                <p className="text-blue-100 mb-8 text-lg max-w-2xl mx-auto">
                  Practice speaking with our AI tutor. Get instant feedback and a tailored curriculum based on your actual performance.
                </p>
                <button 
                  onClick={() => setMode(AppMode.ASSESSMENT)}
                  className="bg-white text-blue-700 px-8 py-4 rounded-full font-bold text-lg shadow-lg hover:bg-blue-50 transition-transform transform hover:scale-105 flex items-center gap-2 mx-auto"
                >
                  <GraduationCap size={24} />
                  Start Level Assessment
                </button>
              </div>
            )}

            {/* User Plan Dashboard */}
            {userPlan && (
              <div className="grid gap-8">
                {/* Level Summary */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6 items-center md:items-start">
                   <div className="bg-blue-50 p-6 rounded-full h-32 w-32 flex items-center justify-center border-4 border-blue-100 flex-shrink-0">
                     <div className="text-center">
                       <span className="block text-xs text-blue-600 font-bold uppercase">Level</span>
                       <span className="block text-3xl font-extrabold text-blue-700">{userPlan.level.split(' ')[0]}</span>
                     </div>
                   </div>
                   <div className="flex-1 text-center md:text-left">
                     <h3 className="text-xl font-bold text-gray-900 mb-2">Assessment Feedback</h3>
                     <p className="text-gray-600 leading-relaxed">{userPlan.feedback}</p>
                     <div className="mt-4 flex gap-3 justify-center md:justify-start">
                        <button onClick={() => setMode(AppMode.ASSESSMENT)} className="text-sm text-blue-600 font-medium hover:underline">Retake Assessment</button>
                     </div>
                   </div>
                </div>

                {/* Scenarios List */}
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <LayoutDashboard className="text-gray-400" size={20}/>
                      Your Training Plan
                    </h3>
                    <span className="text-sm text-gray-500">{userPlan.scenarios.length} Scenarios</span>
                  </div>
                  
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {userPlan.scenarios.map((scenario) => (
                      <div key={scenario.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                          <div className={`px-3 py-1 rounded-full text-xs font-medium 
                            ${scenario.difficulty === 'Beginner' ? 'bg-green-100 text-green-700' : 
                              scenario.difficulty === 'Intermediate' ? 'bg-yellow-100 text-yellow-700' : 
                              'bg-red-100 text-red-700'}`}>
                            {scenario.difficulty}
                          </div>
                          <BrainCircuit size={18} className="text-gray-300" />
                        </div>
                        <h4 className="text-lg font-bold text-gray-900 mb-2">{scenario.title}</h4>
                        <p className="text-gray-600 text-sm mb-4 flex-grow">{scenario.description}</p>
                        
                        <div className="pt-4 border-t border-gray-100 mt-auto">
                           <p className="text-xs text-gray-400 mb-3">Objective: {scenario.objective}</p>
                           <button 
                            onClick={() => startPractice(scenario)}
                            className="w-full py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                           >
                             <BookOpen size={16} />
                             Start Practice
                           </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
