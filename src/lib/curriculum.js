
export const EDUCATION_LEVELS = [
  { id: 'CRECHE', name: 'Creche' },
  { id: 'KINDERGARTEN', name: 'Kindergarten' },
  { id: 'NURSERY', name: 'Nursery' },
  { id: 'PRIMARY', name: 'Primary' },
  { id: 'JSS', name: 'Junior Secondary School (JSS)' },
  { id: 'SSS', name: 'Senior Secondary School (SSS)' },
];

export const LEVEL_CLASSES = {
  CRECHE: ['Creche'],
  KINDERGARTEN: ['Kindergarten 1', 'Kindergarten 2'],
  NURSERY: ['Nursery 1', 'Nursery 2'],
  PRIMARY: ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'],
  JSS: ['JSS 1', 'JSS 2', 'JSS 3'],
  SSS: ['SS 1', 'SS 2', 'SS 3'],
};

export const SSS_STREAMS = [
  { id: 'GENERAL', name: 'General' },
  { id: 'SCIENCE', name: 'Science' },
  { id: 'COMMERCIAL', name: 'Commercial' },
  { id: 'ARTS', name: 'Arts' },
];

export const DEFAULT_SUBJECTS = {
  CRECHE: {
    DEFAULT: ['Sensory Play', 'Motor Skills', 'Basic Communication', 'Nursery Rhymes']
  },
  KINDERGARTEN: {
    DEFAULT: ['Pre-Reading', 'Basic Numeracy', 'Coloring and Art', 'Social Skills', 'Story Telling']
  },
  NURSERY: {
    DEFAULT: ['English Language', 'Mathematics', 'Health Habits', 'Social Norms', 'Creative Arts', 'Basic Science', 'Physical Education']
  },
  PRIMARY: {
    DEFAULT: [
      'English Language', 
      'Mathematics', 
      'Basic Science', 
      'Social Studies', 
      'Civic Education', 
      'Computer Studies', 
      'Agricultural Science', 
      'Physical & Health Education', 
      'Cultural & Creative Arts',
      'Home Economics',
      'Religious Education (CRS/IRS)',
      'History'
    ]
  },
  JSS: {
    DEFAULT: [
      'English Language', 
      'Mathematics', 
      'Basic Science', 
      'Social Studies', 
      'Civic Education', 
      'Business Studies', 
      'Agricultural Science', 
      'Basic Technology', 
      'Home Economics', 
      'French', 
      'Computer Studies',
      'Cultural & Creative Arts',
      'Physical & Health Education',
      'Religious Education (CRS/IRS)',
      'History'
    ]
  },
  SSS: {
    GENERAL: ['English Language', 'Mathematics', 'Civic Education', 'Data Processing', 'Economics'],
    SCIENCE: [
      'Physics', 
      'Chemistry', 
      'Biology', 
      'Further Mathematics', 
      'Agricultural Science', 
      'Technical Drawing',
      'Geography'
    ],
    COMMERCIAL: [
      'Financial Accounting', 
      'Commerce', 
      'Marketing', 
      'Insurance', 
      'Office Practice',
      'Salesmanship'
    ],
    ARTS: [
      'Literature in English', 
      'Government', 
      'History', 
      'Christian Religious Studies (CRS)', 
      'Islamic Religious Studies (IRS)', 
      'Visual Arts',
      'Music',
      'French'
    ]
  }
};
