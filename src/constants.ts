export interface FillInTheBlank {
  id: string;
  text: string;
  blanks: string[];
}

export interface LectureContent {
  id: string;
  type: 'pdf' | 'voice' | 'video' | 'explanation' | 'image' | 'spreadsheet' | 'doc' | 'txt' | 'csv';
  title: string;
  course: string;
  date: string;
  duration?: string;
  size?: string;
  thumbnail?: string;
  url?: string;
  videoUrl?: string; // Embedded video source
  isMine?: boolean; // Label for user uploads
  fillInTheBlanks?: FillInTheBlank[];
  extractedYoutubeMetadata?: boolean;
  channel?: string;
  aiContextAnalysis?: string;
  aiInsights?: any;
}

export const MOCK_LECTURES: LectureContent[] = [
  {
    id: '1',
    type: 'pdf',
    title: 'Advanced Thermodynamics Vol 1',
    course: 'MECH 402',
    date: 'Apr 18, 2026',
    size: '4.2 MB',
    url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf',
    isMine: false,
    fillInTheBlanks: [
      {
        id: 'fb1',
        text: 'The [0] Law of Thermodynamics states that energy cannot be [1] or destroyed, only transformed from one form to another.',
        blanks: ['First', 'created']
      },
      {
        id: 'fb2',
        text: 'The concept of [0] is a measure of the disorder or randomness in a system.',
        blanks: ['entropy']
      },
      {
        id: 'fb3',
        text: 'A [0] process is one in which no heat is transferred into or out of the system.',
        blanks: ['adiabatic']
      }
    ]
  },
  {
    id: '2',
    type: 'video',
    title: 'Thermodynamics: Entropy Generation',
    course: 'MECH 402',
    date: 'Apr 20, 2026',
    duration: '12:45',
    thumbnail: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=400',
    videoUrl: 'https://youtu.be/6D3yzgMNjwU?si=-XAis2VRbECJckdh'
  },
  {
    id: '3',
    type: 'voice',
    title: 'Post-Lecture Notes: Fluid Dynamics',
    course: 'CIVL 301',
    date: 'Apr 21, 2026',
    duration: '05:22',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    isMine: false
  },
  {
    id: '4',
    type: 'explanation',
    title: 'AI Analysis of Navier-Stokes',
    course: 'MECH 402',
    date: 'Apr 22, 2026',
    duration: 'Read'
  },
  {
    id: '5',
    type: 'pdf',
    title: 'Fluid Mechanics - Semester 2',
    course: 'CIVL 301',
    date: 'Apr 15, 2026',
    size: '2.8 MB',
    url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf',
    fillInTheBlanks: [
      {
        id: 'fb4',
        text: 'The [0] equation describes the relationship between pressure, velocity, and elevation in a flowing fluid.',
        blanks: ['Bernoulli']
      },
      {
        id: 'fb5',
        text: 'Viscosity is a measure of a fluid\'s resistance to [0].',
        blanks: ['flow']
      }
    ]
  },
  {
    id: '6',
    type: 'pdf',
    title: 'Course Syllabus & Guidelines',
    course: 'MECH 402',
    date: 'Apr 10, 2026',
    size: '45 KB',
    url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf',
    isMine: false
  },
  {
    id: '7',
    type: 'voice',
    title: 'Weekly Seminar: Structural Analysis',
    course: 'CIVL 301',
    date: 'Apr 25, 2026',
    duration: '45:00',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    isMine: false
  },
  {
    id: '8',
    type: 'pdf',
    title: 'Exam Preparation Guide',
    course: 'MECH 402',
    date: 'May 01, 2026',
    size: '1.5 MB',
    url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf'
  },
  {
    id: '9',
    type: 'video',
    title: '3 tips on how to study effectively',
    course: 'MECH 402',
    date: 'May 05, 2026',
    duration: '05:09',
    thumbnail: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=400',
    videoUrl: 'https://youtu.be/TjPFZaMe2yw?si=OIgtqC5jCz1uIvKV'
  },
  {
    // New YouTube focus/study session video requested by user
    id: '10',
    type: 'video',
    title: 'Deep Work Focus Music Session',
    course: 'MECH 402',
    date: 'May 15, 2026',
    duration: '02:00:00', // Accurate duration and metadata will also be dynamically extracted on player load
    thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=400',
    videoUrl: 'https://youtu.be/1OO8j3lz-i8?si=0904bGy9UBihRNO6'
  },
  {
    id: 'u1',
    type: 'pdf',
    title: 'My Physics Notes',
    course: 'PHYS 101',
    date: 'May 10, 2026',
    size: '1.2 MB',
    isMine: true
  },
  {
    id: 'u2',
    type: 'voice',
    title: 'Personal Study Memo',
    course: 'GEN 100',
    date: 'May 12, 2026',
    duration: '02:15',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    isMine: true
  }
];
