type IllnessId = 'calici' | 'forl' | 'asthma' | 'fiv';

export interface CatIllness {
  readonly id: IllnessId;
  readonly name: string;
  readonly sourceUrl: string;
}

export const CAT_ILLNESSES: readonly CatIllness[] = [
  { id: 'calici', name: 'Calici', sourceUrl: 'https://ictv.global/taxonomy/taxondetails?taxnode_id=20182810' },
  { id: 'forl', name: 'FORL', sourceUrl: 'https://www.vin.com/apputil/content/defaultadv1.aspx?meta=Generic&pId=8768&id=3850090' },
  {
    id: 'asthma',
    name: 'Asthma',
    sourceUrl:
      'https://www.vet.cornell.edu/departments-centers-and-institutes/cornell-feline-health-center/health-information/feline-health-topics/feline-asthma-what-you-need-know',
  },
  {
    id: 'fiv',
    name: 'FIV',
    sourceUrl:
      'https://www.vet.cornell.edu/departments-centers-and-institutes/cornell-feline-health-center/health-information/feline-health-topics/feline-immunodeficiency-virus-fiv',
  },
];
