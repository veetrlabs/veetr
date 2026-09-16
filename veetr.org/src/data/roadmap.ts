export type MilestoneState = 'done' | 'in-progress' | 'planned';
export const stateLabels: Record<MilestoneState, string> = {
  done: 'Done', 'in-progress': 'In progress', planned: 'Planned',
};

// Status confirmed by the founder: 1–7 done, 8–11 in progress, 12–19 planned.
// Replace the first milestone's placeholder with the supplied prototype photo.
export const milestones: { title: string; state: MilestoneState; text: string; note?: string; image?: string }[] = [
  { title: 'Hardware prototype', state: 'done', text: 'The first wired breadboard brought the sensors and electronics together: a starting point we could build, measure and learn from.', image: 'placeholder' },
  { title: 'Writing firmware', state: 'done', text: 'Read the sensors, process the measurements and send sailing data from the device.' },
  { title: 'PWA build', state: 'done', text: 'Build a Progressive Web App to show the device’s data on a phone or tablet, directly in the browser.' },
  { title: 'Custom PCB', state: 'done', text: 'Replace loose prototype wiring with a custom circuit board, reducing disconnected wires when handling the device.' },
  { title: 'Custom 3D printed case', state: 'done', text: 'Give the electronics a practical enclosure for mounting, handling and prototype testing.' },
  { title: 'Proof of concept', state: 'done', text: 'Testing confirmed the idea could work and showed where the first prototype fell short.', note: 'What we learned: displays were hard to read, the PWA stopped tracking with the screen off, and Bluetooth needed pairing each time.' },
  { title: 'A new hardware prototype', state: 'done', text: 'Built a new prototype with a reflective LCD display, SD card storage and battery power, so the device can display and record data on its own.' },
  { title: 'Race management system', state: 'in-progress', text: 'Simplify race administration for our referee and make races easier to follow for sailors and spectators.' },
  { title: 'Mobile apps for iOS and Android', state: 'in-progress', text: 'Use the phone’s GPS by default. Connect a Veetr device for wind speed, wind direction and an external GPS source.', note: 'The goal: reliable reconnection and tracking with the screen off. Any GPS accuracy improvement needs to be measured in real conditions.' },
  { title: 'Live race positions', state: 'in-progress', text: 'Let sailors share their position during a race, with clear sharing controls and a useful view for spectators. Test coverage gaps and delayed updates.' },
  { title: 'Real races. First users.', state: 'in-progress', text: 'Put the system into real races with early users. Observe setup, tracking and race administration, and fix what gets in the way.' },
  { title: 'Validate demand and market fit', state: 'planned', text: 'Learn who needs Veetr enough to keep using it. Start conversations now, then use repeated trials to test demand before committing to production.', note: 'Evidence to seek: sailors returning for another race, clubs committing to a pilot, and people expressing purchase intent at a realistic price. A mailing-list signup alone is not product–market fit.' },
  { title: 'Establish Veetr s.r.o.', state: 'planned', text: 'Set up the company and the practical foundations for manufacturing, customer support and selling the finished product.' },
  { title: 'Design the production device', state: 'planned', text: 'Build around certified components where appropriate, improve functionality and settle the production design.', note: 'Start compliance planning early: confirm requirements with a lab, obtain quotes, run pre-compliance checks and budget for fixes. Certified components do not certify the complete device.' },
  { title: 'Waterproof case', state: 'planned', text: 'Develop and test the enclosure, seals, connectors and mounting. Publish a water-protection rating only after it has been verified.' },
  { title: 'Real-life testing', state: 'planned', text: 'Test the production design on the water: sunlight readability, battery life, GPS performance, connection recovery, water exposure and day-to-day handling.' },
  { title: 'Hardware certifications', state: 'planned', text: 'Complete the applicable testing and conformity assessment for the finished device, with technical documentation, labels and instructions.', note: 'The blocker to hardware sales. The final design, test scope, lab quotes and funding must be in place before we can clear it.' },
  { title: 'Small-batch manufacturing', state: 'planned', text: 'Build a pilot batch, check every unit and confirm repeatable assembly. Prepare supply, packaging, traceability and a repair process before scaling up.' },
  { title: 'Sales', state: 'planned', text: 'Offer finished Veetr devices when compliance, manufacturing and customer support are ready. Publish the actual price, availability and delivery expectations then.' },
];
