# Shift Match

**When a home care visit gets cancelled, Shift Match finds the caregiver most likely to cover it, sends the offers, and re-ranks the list every time someone answers.**

Live demo: _add your Amplify URL here_

Today a coordinator handles a call-out by phoning whoever lives closest, then the next person, then the next. Shift Match turns that into a ranked, explainable, automatic process:

1. **Hard rules filter people out.** Available for every hour of the visit, not already booked, has every required skill (dementia care, Hoyer lift, Spanish/Creole, …), holds the payer credential (VA or Medicaid), won't go over their weekly max, and isn't the person who cancelled. Everyone filtered out shows the exact rule they failed.
2. **A model predicts who will say yes.** A logistic regression trained on six weeks of past offers scores each qualified caregiver on:
   - driving distance to the client
   - whether they've served this client before
   - weekly hours after this visit (near overtime → fewer yeses)
   - notice time (short notice is harder)
   - weekend vs weekday
   - how many offers they got in the last 7 days
   - their own past acceptance rate
   - their time-of-day preference (mornings, afternoons, evenings)
3. **New caregivers aren't ignored.** With little history, their acceptance rate starts at their skill group's average and moves toward their own as answers come in.
4. **Fairness.** People asked more than the team's median this week get a small penalty, so the same three people don't get every text.
5. **Live dispatch.** Send offers one at a time (next best gets it after a decline or 8–15 min of silence) or to the top 3 at once (first yes wins, the next in line backfills). Each decline comes back with a reason. "Too far" makes distance weigh more for this visit, "time doesn't work" boosts time-of-day fit, and the list re-ranks before the next offer goes out. Every answer is also one more training example for the model.
6. **Log a cancellation** from the top bar and it's ranked the moment you save.

The **Simulation** tab replays hundreds of random cancellations against the same simulated caregivers under three strategies (Shift Match one at a time, Shift Match top 3, random qualified pick) and compares minutes to fill, offers per shift, fill rate and how evenly offers are spread.

> Prototype: there's no backend. The agency (8 clients and 25 caregivers in real Miami neighborhoods) lives in memory, and each caregiver's reaction to an offer is simulated from a hidden temperament the model never sees. The model only learns from the yes, no or no reply it gets back, like it would with real people.

## Run it

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # engine + routing tests
npm run build    # type-check and build the static site into dist/
```

Requires Node 20.19 or newer.

## How the code is organized

```
src/
  lib/
    api.ts            the only module the UI calls; swap these functions for fetch() to add a backend
    types.ts          shared types
    mock.ts           seed data: clients, caregivers, skills, availability, coordinates
    engine/
      world.ts        builds the agency state and six weeks of offer history; hard rules
      features.ts     what the model can observe about an offer
      model.ts        logistic regression: training, prediction, online updates, AUC
      ranking.ts      hard rules → likelihood → fairness penalty → plain-English reasons
      dispatch.ts     live offer loop that learns from answers and re-ranks
      simulation.ts   strategy comparison
      truth.ts        simulated caregiver behavior (the "real people")
  features/           Dispatch, Caregivers, Shifts, Simulation, How it works pages
  components/         app shell, cards, dialog, shared UI
```

## Deploy on AWS Amplify

1. In Amplify Hosting choose **Deploy an app → GitHub**, pick this repo and the `main` branch. Amplify reads `amplify.yml` (Node 22, `npm ci`, tests, `npm run build`, publishes `dist/`).
2. After the first deploy, open **Hosting → Rewrites and redirects** and add the single-page app rule so deep links like `/simulation` work:

   | Source address | Target address | Type |
   | --- | --- | --- |
   | `</^[^.]+$\|\.(?!(css\|gif\|ico\|jpg\|js\|png\|txt\|svg\|woff\|woff2\|ttf\|map\|json\|webp)$)([^.]+$)/>` | `/index.html` | 200 (Rewrite) |

The frontend was first designed in Lovable; the matching engine, data, tests and the static Vite build were added afterwards.
