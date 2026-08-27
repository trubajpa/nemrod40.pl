export type NewsItem = {
  slug: string
  title: string
  date: string
  lead: string
  description: string
  image: string
  imageAlt: string
  gallery: { src: string; alt: string }[]
  category: string
  video?: string
}

export const news: NewsItem[] = [
  {
    slug: 'nowa-przyczepa-transportowa', title: 'Nowa przyczepa transportowa', date: 'Sierpień 2026', category: 'Gospodarka',
    lead: 'Nowe wyposażenie usprawni prace terenowe i codzienne zadania gospodarcze.',
    description: 'Koło zakupiło przyczepę wspierającą działania terenowe, transport wyposażenia oraz realizację bieżących zadań gospodarczych.',
    image: '/images/activities/przyczepa-transportowa/przyczepa-01.webp', imageAlt: 'Nowa przyczepa transportowa Koła Nemrod',
    gallery: [{ src: '/images/activities/przyczepa-transportowa/przyczepa-01.webp', alt: 'Przyczepa przygotowana do prac terenowych' }],
  },
  {
    slug: 'remont-dachu-garazu', title: 'Remont dachu garażu', date: 'Lipiec 2026', category: 'Zaplecze',
    lead: 'Wspólna praca członków Koła przy zabezpieczeniu zaplecza gospodarczego.',
    description: 'Członkowie Koła wykonali remont dachu garażu, poprawiając stan techniczny i zabezpieczenie zaplecza gospodarczego.',
    image: '/images/activities/remont-garazu/remont-02.webp', imageAlt: 'Członkowie Koła podczas remontu dachu garażu',
    gallery: [1, 2, 3].map((n) => ({ src: `/images/activities/remont-garazu/remont-0${n}.webp`, alt: `Prace przy remoncie dachu garażu – ujęcie ${n}` })),
  },
  {
    slug: 'przyroda-i-lowiectwo-zajecia-edukacyjne', title: 'Przyroda i łowiectwo – zajęcia edukacyjne w szkole', date: 'Czerwiec 2026', category: 'Edukacja',
    lead: 'Rozmowa z uczniami o przyrodzie, zwierzętach i odpowiedzialnym łowiectwie.',
    description: 'Zajęcia dla uczniów szkoły podstawowej dotyczące przyrody, zwierząt, środowiska leśnego oraz odpowiedzialnego łowiectwa. Inicjatywa została przygotowana przez Przemysława Szczukę i Tomasza Walczaka.',
    image: '/images/events/edukacja-w-szkole/szkolenie-04.webp', imageAlt: 'Zajęcia przyrodnicze prowadzone dla uczniów szkoły podstawowej',
    gallery: [1, 2, 3, 4].map((n) => ({ src: `/images/events/edukacja-w-szkole/szkolenie-0${n}.webp`, alt: `Zajęcia edukacyjne w szkole – ujęcie ${n}` })),
  },
  {
    slug: 'nowe-urzadzenie-do-pasow-zaporowych', title: 'Nowe urządzenie do wykonywania pasów zaporowych', date: 'Maj 2026', category: 'Ochrona upraw',
    lead: 'Sprzęt wspiera ograniczanie szkód w uprawach i współpracę z rolnikami.',
    description: 'Koło pozyskało urządzenie wspierające działania zmierzające do ograniczania szkód w uprawach rolnych. Pasy zaporowe pomagają zatrzymać zwierzynę w kompleksach leśnych i stanowią element współpracy z rolnikami.',
    image: '/images/activities/ochrona-upraw/pasy-zaporowe-01.webp', imageAlt: 'Urządzenie wykorzystywane do wykonywania pasów zaporowych',
    gallery: [1, 2].map((n) => ({ src: `/images/activities/ochrona-upraw/pasy-zaporowe-0${n}.webp`, alt: `Prace związane z ochroną upraw – ujęcie ${n}` })),
  },
  {
    slug: 'biesiada-kola-lowieckiego-nemrod', title: 'Biesiada Koła Łowieckiego Nemrod', date: 'Grudzień 2025', category: 'Tradycja',
    lead: 'Spotkanie członków i sympatyków służące wspólnocie i kultywowaniu tradycji.',
    description: 'Spotkanie integracyjne członków i sympatyków Koła, służące kultywowaniu tradycji, budowaniu wspólnoty oraz podsumowaniu wspólnych działań.',
    image: '/images/brand/logo-pzl-dekoracyjne.png', imageAlt: 'Dekoracyjny znak Polskiego Związku Łowieckiego', gallery: [], video: '/videos/biesiada-nemrod.mp4',
  },
  {
    slug: 'edukacja-przyrodnicza-w-terenie', title: 'Edukacja przyrodnicza w terenie', date: 'Listopad 2025', category: 'Edukacja',
    lead: 'Leśne zajęcia dla uczniów zakończone wspólnym ogniskiem.',
    description: 'Spotkanie z uczniami szkoły podstawowej zorganizowane we współpracy z leśnictwem. Zajęcia dotyczyły lasu, przyrody, zwierząt oraz roli odpowiedzialnej gospodarki łowieckiej. Spotkanie zakończyło się wspólnym ogniskiem.',
    image: '/images/events/ognisko-edukacyjne/ognisko-01.webp', imageAlt: 'Uczestnicy terenowych zajęć edukacyjnych przy ognisku',
    gallery: [1, 2, 3].map((n) => ({ src: `/images/events/ognisko-edukacyjne/ognisko-0${n}.webp`, alt: `Edukacja przyrodnicza w terenie – ujęcie ${n}` })),
  },
]
