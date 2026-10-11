import { html, type TemplateResult } from 'lit';

/** Renders a link to another site. */
export type LinkRenderer = (url: string, label: string) => TemplateResult;

export interface CatModelCredit {
  readonly modelName: string;
  readonly sourceUrl: string;
  readonly author: string;
  readonly authorUrl: string;
  readonly license: string;
  readonly licenseUrl: string;
}

export const pages = {
  aboutStory: [
    'Blacky is a cat from Ukraine. Probably in 2021, he was abandoned and taken in by a local animal rescue group. He later found a new home.',
    'Over the last years some challenges came along. He arrived with an eye injury and was nursed back. Months later he was diagnosed with calici, and his teeth were affected by FORL – by now they have all been pulled. In 2025 asthma was added. After years of treatment he was doing better. An inquiry about a feline companion was initially declined because of his FIV diagnosis. The search continues.',
    'Today he goes out in a secure garden and, after years full of challenges, lives fairly healthy.',
    'Blacky carries scars in his soul from his time as a street cat. He is afraid of dogs, extremely jealous, and plays as soon as he is awake.',
  ],
  whatIsThat: 'What is that, actually?',
  illnesses: {
    calici: {
      explanation:
        'Feline calicivirus is a contagious virus and one of the causes of cat flu. Typical signs are sneezing, fever and painful inflammation in the mouth. In some cats the infection stays for good.',
      sourceLabel: 'Cornell College of Veterinary Medicine',
    },
    forl: {
      explanation:
        'With FORL (feline odontoclastic resorptive lesions) the body’s own cells dissolve the roots of the teeth. Depending on the study it affects a large share of cats, it hurts and it gets worse. The cause is unknown. It is treated by pulling the tooth or removing the crown.',
      sourceLabel: 'Specialist article (VIN)',
    },
    asthma: {
      explanation:
        'Feline asthma is an allergic reaction of the airways to substances breathed in. The airways become inflamed and narrow, the cat coughs, wheezes or breathes heavily. It cannot be cured, but with medication and watchful care many cats live well with it.',
      sourceLabel: 'Cornell Feline Health Center',
    },
    fiv: {
      explanation:
        'FIV (feline AIDS) weakens the immune system and is passed on mainly by bites. It is harmless to people. With good care infected cats can reach a normal age. Living together with uninfected cats can work in a calm group, but the risk remains if they bite each other.',
      sourceLabel: 'Cornell Feline Health Center',
    },
  },
  source: 'Source:',
  noVetAdvice: 'This is general information and does not replace advice from a vet.',
  notAPurpose: 'A pet is not a purpose',
  notAPurposeText: [
    'Never get a pet for a particular purpose or on an impulse. A pet is part of the family, with everything that comes with it, even when it falls ill.',
    'This is a personal project. If you are thinking about adopting a cat: ask at your local animal shelter or an animal welfare group near you.',
  ],
  privacy: [
    {
      heading: null,
      text: 'This game collects no data about you. There are no accounts, no statistics, no ads and no cookies. The game sends nothing to the internet.',
    },
    {
      heading: 'Stored on your device',
      text: 'Your browser keeps your cat, your kart and your settings (sound, graphics, controls, view, language) on your device. These are not personal data, and they never leave your device. You delete them by clearing the site data of this page in your browser settings.',
    },
    {
      heading: 'Camera',
      text: 'The camera is only needed for “Invite players”, to read the QR code of a phone. The picture is only analysed on your device and never stored or sent.',
    },
    {
      heading: 'Player phones',
      text: 'The phones connect directly to each other in the same Wi-Fi, without a server in between. They exchange their network addresses and the input for the game. Afterwards none of it is stored.',
    },
    {
      heading: 'When the page is opened',
      text: 'As with every website, the provider that hosts the game sees your IP address and the time of the visit in its log files. This game has no influence on that.',
    },
    { heading: 'Links', text: 'Behind links to other sites (for example in “About Blacky” and “Credits”) their own privacy rules apply.' },
  ],
  credits: (cat: CatModelCredit, link: LinkRenderer): TemplateResult => html`
    Cat model ${link(cat.sourceUrl, `"${cat.modelName}"`)} by ${link(cat.authorUrl, cat.author)}, licensed under
    ${link(cat.licenseUrl, cat.license)}. Colours, patterns and proportions were adapted for this game.
    <br /><br />
    House model ${link('https://poly.pizza/m/9UGOIbCy8C', '"House Interiors"')} by Gabriele Romagnoli, licensed under
    ${link('https://creativecommons.org/licenses/by/3.0/', 'CC-BY')} via Poly Pizza.
    <br /><br />
    Nature models "Stylized Nature MegaKit" by ${link('https://quaternius.com', 'Quaternius')} via Poly Pizza (CC0). Space models "Ultimate Space
    Kit" also by Quaternius via Poly Pizza (CC0). Ground textures by ${link('https://polyhaven.com', 'Rob Tuytel')} via Poly Haven (CC0).
  `,
};
