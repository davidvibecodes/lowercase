// Source: Consult Club, IIM Ahmedabad casebook ("Diagnostic Center – Approach" and
// "Interview Transcript" slides). Seeded for the owner's local personal use only;
// not to be shared without permission.
import type { CaseSeed } from "../../../src/lib/types";
import { flattenTree, n } from "../tree";

const I = "interviewer" as const;
const C = "candidate" as const;

export const diagnosticMumbai: CaseSeed = {
  title: "Diagnostic Center – Mumbai",
  caseType: "Profitability",
  difficulty: 1,
  published: true,
  problemStatement:
    "Your client is a diagnostic chain in Mumbai. They have seen a decrease in profitability and want you to figure out why.",
  facts: [
    "Decrease in revenue with costs unchanged",
    "Centres in North, South, West and East areas of Mumbai",
    "Specialized tests are not conducted by our client",
    "Colaba center (contributing to 45% of total revenues) is the only one facing reduction in revenues",
    "Centralized path-laboratory but radiology is done at the center",
  ],
  hints: [
    "Important to start by understanding the various functions of the centers before diving deeper into the value chain",
    "Zeroing in on geography & center is useful towards identifying the problem given Colaba-specific nature of the issue and the large revenue share of that center",
    "Given limited understanding of the value chain within pathology, mathematical breakdown of revenues can be a helpful option",
  ],
  recommendations: [
    "Partner with more and more third-party platforms",
    "Launch own website/app for booking",
    "Provide centralized lab services of testing and reporting to other diagnostic centers",
  ],
  observations: [
    "Continuously sharing your hypothesis along with questions can lead to much quicker analysis of the case",
    "Using the 3C-1P framework for preliminary questions could have enabled an understanding of online competitors early on",
  ],
  tree: flattenTree(
    n("Revenues", true, [
      n("Radiology"),
      n("Pathology", true, [
        n("Number of Patients", true, [
          n("Demand", true, [
            n("In-Center Visits", true, [
              n("Direct Referrals", true, [
                n("Patient"),
                n("Doctor", true, [
                  n("External", true, [n("Indirect Competition", true), n("Direct Competition")]),
                  n("Internal"),
                ]),
              ]),
              n("Self Prescription"),
              n("Third Party Platforms"),
            ]),
            n("At-Home Service"),
          ]),
          n("Supply"),
        ]),
        n("Number of Tests/Patient"),
        n("Average Price/Test"),
      ]),
    ]),
  ),
  transcript: [
    { speaker: I, text: "Your client is a diagnostic chain in Mumbai. They have seen a decrease in profitability and want you to figure out why." },
    { speaker: C, text: "To help me understand the problem better, please let me know if we have data about the magnitude of the decrease in profitability? Since when?" },
    { speaker: I, text: "It is a recent phenomenon seen in the last 5 months. We do not have data about the exact drop in profitability." },
    { speaker: C, text: "Next, I would like to better understand our client. Could you elaborate on the services provided by them? As far as my understanding goes, diagnostic chains offer a host of services like blood tests, x-rays, USG, etc." },
    { speaker: I, text: "Correct. Diagnostic tests can be primarily divided into 3 categories: Pathological tests comprise blood, urine, stool tests. Radiological tests comprise X-rays, USG, CT-Scan, MRI. Specialty tests comprise ECG, EEG, Endoscopy, COVID-19, etc." },
    { speaker: C, text: "Okay! Does our client provide all the three types of services?" },
    { speaker: I, text: "No, we provide pathological and radiological services." },
    { speaker: C, text: "That's helpful! Given you mentioned they operate a chain, how many centres do they have in Mumbai?" },
    { speaker: I, text: "There are 4 centers, one each in the South, West, East, and North areas." },
    { speaker: C, text: "Is the decrease faced by all centres? Are some particular centres more likely to face this decline?" },
    { speaker: I, text: "Good question. The south center in Colaba, which is our oldest center and contributes 45% of our business is the only center facing this issue." },
    { speaker: C, text: "Okay! Next, I would like to understand the value chain of our client's operations. Does each centre operate independently or are there some centralized operations (for example - centralized labs & finance functions)." },
    { speaker: I, text: "We have a central laboratory, where samples from each center are sent for testing and reporting. The radiological services are carried out by each center independently." },
    { speaker: C, text: "Thank you, I have all the preliminary information I need. To begin with, I want to analyze profits as a function of revenue and costs. Do we have data about how these have been affected?" },
    { speaker: I, text: "Revenues have declined. However, costs have remained the same." },
    { speaker: C, text: "The two streams of revenue will be pathological and radiological services. Another possible source can be the use of center infrastructure for purposes other than diagnostics. We should have data about the revenue split, and if a particular stream is affected?" },
    { speaker: I, text: "Revenues from the pathological tests have taken a hit." },
    { speaker: C, text: "Given the specified time period, I would like to break revenues from pathological tests for a centre as No. of patient footfalls * No. of tests/patient * Average price/test. Is this a fair breakdown? Do we have data about these parameters?" },
    { speaker: I, text: "There has been a decrease in the no. of patient footfalls." },
    { speaker: C, text: "I would like to examine this from the demand and supply perspective. As only one centre is affected, and the operations of pathological tests are centralized across centres, I believe that it should be a demand-side issue." },
    { speaker: I, text: "Good, that's a fair point. Yes, the demand has reduced." },
    { speaker: C, text: "To analyze further, I would like to understand the various channels through which patients are able to use the pathological services." },
    { speaker: I, text: "The patients either visit us at our center or choose the at-home test service, to get the pathological tests done." },
    { speaker: C, text: "Okay, and are we facing reduced demand and revenue from both these channels?" },
    { speaker: I, text: "No, the reduction in demand has been in the in-center visits." },
    { speaker: C, text: "Next, I would like to analyze the various sources of demand for in-centre visits. These would be direct referrals from health centres like nursing homes, clinics in the vicinity, self-prescribed (ones who visit on their own - like for regular tests), and through any third-party platforms (online or offline)" },
    { speaker: I, text: "That is fair. The no. of patient footfalls through direct referrals has reduced." },
    { speaker: C, text: "I would like to know, are there any specific health centres from where we use to receive the highest proportion of direct referrals?" },
    { speaker: I, text: "Yes, there are 3 specialty nursing homes in the vicinity, from where we get more than 80% of such patients. There has been a reduction from all these 3 nursing homes." },
    { speaker: C, text: "Okay, I think the reasons for the same can be nursing home/doctor-related or patient-related. The doctor-related reasons could be a decrease in patient flow at the hospital, preferring some other diagnostic center for referrals or starting their own pathological services. The patient-related factors could be preferring a competitor service due to better price, service quality, or convenience." },
    { speaker: I, text: "Fair enough, so the doctors at these nursing homes have started teleconsultation services on a third-party online platform. The patients prefer to use these services whenever feasible. This has led to a reduction in the physical footfall at the nursing homes. Also, we do not provide services through this platform. What would be your recommendation?" },
    { speaker: C, text: "My recommendations will be to try and get listed on this platform and look to acquire these patients through our at-home test service. We should also look at getting listed on more such online healthcare platforms to diversify the sources of our demand. We can also look at launching our own website and app for booking tests (if not already done), As we have a centralized lab, if not utilized at full capacity, we should also look at providing testing and reporting services to other diagnostics." },
    { speaker: I, text: "Good, Thank you." },
  ],
};
