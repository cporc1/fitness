// Gym exercise library. Every program exercise points at an id here.
//
// type:  'weight'      weight × reps
//        'bodyweight'  reps only (optional added weight)
//        'assisted'    machine assistance × reps (less assistance = harder)
//        'time'        seconds held
//        'weight_time' weight × seconds (carries)
//        'cardio'      minutes (+ optional distance)
// inc:   suggested jump once you own the top of the rep range { lb, kg }
// perHand: logged weight is one dumbbell / one hand

export const GROUPS = ['Legs', 'Chest', 'Back', 'Shoulders', 'Arms', 'Core', 'Cardio'];

export const EXERCISES = [
  // ---------------- Legs ----------------
  {
    id: 'leg-press', name: 'Leg Press', group: 'Legs', equipment: 'Machine', type: 'weight', compound: true,
    muscles: 'Quads, glutes, hamstrings', inc: { lb: 10, kg: 5 }, level: 1,
    steps: [
      'Sit with your back and hips flat against the pad. Feet shoulder-width apart in the middle of the platform.',
      'Release the safety handles. Lower the platform by bending your knees toward your chest.',
      'Stop when your hips start to peel off the seat or your knees reach about 90°.',
      'Press through your whole foot to straighten your legs, stopping just short of locking your knees.',
    ],
    cues: ['Knees track over your toes', 'Lower back stays glued to the pad', 'Push through mid-foot and heels'],
    mistakes: ['Locking the knees hard at the top', 'Letting the hips roll up at the bottom', 'Bouncing out of the bottom'],
    alts: ['goblet-squat', 'back-squat', 'split-squat'],
  },
  {
    id: 'goblet-squat', name: 'Goblet Squat', group: 'Legs', equipment: 'Dumbbell', type: 'weight', compound: true,
    muscles: 'Quads, glutes, core', inc: { lb: 5, kg: 2 }, level: 1,
    steps: [
      'Hold one dumbbell vertically against your chest, both hands cupping the top end.',
      'Stand with feet slightly wider than shoulders, toes turned out a little.',
      'Sit down between your heels, keeping your chest tall and elbows inside your knees.',
      'Go as low as you can while keeping your heels down and back neutral, then stand back up.',
    ],
    cues: ['Chest up, elbows down', 'Spread the floor with your feet', 'Exhale on the way up'],
    mistakes: ['Heels lifting off the floor', 'Knees caving inward', 'Rounding the lower back at the bottom'],
    alts: ['leg-press', 'back-squat', 'split-squat'],
  },
  {
    id: 'back-squat', name: 'Barbell Back Squat', group: 'Legs', equipment: 'Barbell', type: 'weight', compound: true,
    muscles: 'Quads, glutes, adductors, core', inc: { lb: 10, kg: 5 }, level: 2,
    steps: [
      'Set the bar in a squat rack at about armpit height. Set the safety bars just below your bottom position.',
      'Step under the bar and rest it on your upper back (not your neck). Grip it just outside your shoulders.',
      'Stand up to lift it off the hooks, take two or three small steps back, feet about shoulder-width.',
      'Brace your core, then bend hips and knees together and sit down until your thighs are about parallel to the floor.',
      'Drive up through your whole foot to stand tall. Re-rack by walking forward until the bar touches the uprights.',
    ],
    cues: ['Big breath and brace before each rep', 'Knees follow your toes', 'Bar stays over mid-foot'],
    mistakes: ['Skipping the safety bars', 'Heels lifting', 'Good-morning: hips rise faster than the chest'],
    alts: ['goblet-squat', 'leg-press'],
  },
  {
    id: 'split-squat', name: 'Dumbbell Split Squat', group: 'Legs', equipment: 'Dumbbell', type: 'weight', compound: true, perHand: true,
    muscles: 'Quads, glutes (one leg at a time)', inc: { lb: 5, kg: 2 }, level: 1, unilateral: true,
    steps: [
      'Hold a dumbbell in each hand. Take a long step forward so you are in a staggered stance.',
      'Lower straight down until your back knee almost touches the floor.',
      'Push through the front foot to come back up. Finish all reps, then switch legs.',
    ],
    cues: ['Torso tall', 'Front knee over mid-foot', 'Reps are per leg'],
    mistakes: ['Stance too narrow, like a tightrope', 'Pushing off the back foot'],
    alts: ['walking-lunge', 'step-up', 'goblet-squat'],
  },
  {
    id: 'walking-lunge', name: 'Dumbbell Walking Lunge', group: 'Legs', equipment: 'Dumbbell', type: 'weight', compound: true, perHand: true,
    muscles: 'Quads, glutes, balance', inc: { lb: 5, kg: 2 }, level: 1, unilateral: true,
    steps: [
      'Hold a dumbbell in each hand at your sides.',
      'Step forward and lower until both knees are bent about 90°.',
      'Drive through the front foot and bring the back leg through into the next step.',
    ],
    cues: ['Controlled steps, not a race', 'Reps are per leg', 'Start with bodyweight if balance is shaky'],
    mistakes: ['Front knee collapsing inward', 'Short choppy steps'],
    alts: ['split-squat', 'step-up'],
  },
  {
    id: 'step-up', name: 'Dumbbell Step-Up', group: 'Legs', equipment: 'Dumbbell', type: 'weight', compound: true, perHand: true,
    muscles: 'Quads, glutes', inc: { lb: 5, kg: 2 }, level: 1, unilateral: true,
    steps: [
      'Stand facing a sturdy box or bench about knee height, a dumbbell in each hand.',
      'Place one whole foot on the box and stand up on it, driving through that heel.',
      'Step down slowly with the other leg. Finish all reps on one side, then switch.',
    ],
    cues: ['Let the top leg do the work', 'Stand fully tall at the top'],
    mistakes: ['Pushing off with the bottom foot', 'Box so high your hip shifts'],
    alts: ['split-squat', 'walking-lunge'],
  },
  {
    id: 'db-rdl', name: 'Dumbbell Romanian Deadlift', group: 'Legs', equipment: 'Dumbbell', type: 'weight', compound: true, perHand: true,
    muscles: 'Hamstrings, glutes, lower back', inc: { lb: 5, kg: 2 }, level: 1,
    steps: [
      'Stand tall with a dumbbell in each hand in front of your thighs, feet hip-width.',
      'Soften your knees slightly and push your hips back, sliding the dumbbells down your legs.',
      'Lower until you feel a strong stretch in your hamstrings (usually just below the knee).',
      'Squeeze your glutes and drive your hips forward to stand back up.',
    ],
    cues: ['It is a hip hinge, not a squat', 'Flat back, neck neutral', 'Weights stay close to your legs'],
    mistakes: ['Rounding the back to reach lower', 'Bending the knees too much', 'Leaning back at the top'],
    alts: ['bb-rdl', 'leg-curl', 'back-extension'],
  },
  {
    id: 'bb-rdl', name: 'Barbell Romanian Deadlift', group: 'Legs', equipment: 'Barbell', type: 'weight', compound: true,
    muscles: 'Hamstrings, glutes, lower back', inc: { lb: 10, kg: 5 }, level: 2,
    steps: [
      'Start standing, holding the bar at hip height with a shoulder-width grip (take it from a rack at thigh height).',
      'Soften your knees and push your hips back, letting the bar slide down your thighs.',
      'Stop when your hamstrings are fully stretched and your back is still flat.',
      'Drive your hips forward to stand up tall.',
    ],
    cues: ['Bar drags along your legs', 'Shoulders over the bar', 'Hips back like closing a car door with your butt'],
    mistakes: ['Rounding the lower back', 'Turning it into a squat'],
    alts: ['db-rdl', 'trap-bar-deadlift'],
  },
  {
    id: 'trap-bar-deadlift', name: 'Trap Bar Deadlift', group: 'Legs', equipment: 'Barbell', type: 'weight', compound: true,
    muscles: 'Glutes, quads, hamstrings, back, grip', inc: { lb: 10, kg: 5 }, level: 2,
    steps: [
      'Stand in the middle of the hex/trap bar, feet hip-width.',
      'Hinge and bend your knees to grip the handles. Flat back, chest up.',
      'Brace your core, then push the floor away to stand up tall.',
      'Lower under control by pushing hips back and bending knees together.',
    ],
    cues: ['Push the floor away', 'Arms are just hooks', 'Lock out with glutes, not by leaning back'],
    mistakes: ['Jerking the bar off the floor', 'Rounded back', 'Hyperextending at the top'],
    alts: ['deadlift', 'db-rdl', 'leg-press'],
  },
  {
    id: 'deadlift', name: 'Barbell Deadlift', group: 'Legs', equipment: 'Barbell', type: 'weight', compound: true,
    muscles: 'Glutes, hamstrings, back, grip', inc: { lb: 10, kg: 5 }, level: 2,
    steps: [
      'Stand with mid-foot under the bar, feet hip-width.',
      'Hinge down and grip the bar just outside your legs. Shins touch the bar.',
      'Flatten your back, take the slack out of the bar, and brace.',
      'Push the floor away and stand up, keeping the bar against your legs.',
      'Lower it by pushing hips back first, then bending the knees once the bar passes them.',
    ],
    cues: ['Bar over mid-foot', 'Chest up, lats tight', 'Every rep starts from a dead stop'],
    mistakes: ['Bar drifting away from the legs', 'Rounding the back', 'Squatting the bar up'],
    alts: ['trap-bar-deadlift', 'bb-rdl'],
  },
  {
    id: 'leg-curl', name: 'Leg Curl (Machine)', group: 'Legs', equipment: 'Machine', type: 'weight', compound: false,
    muscles: 'Hamstrings', inc: { lb: 5, kg: 2.5 }, level: 1,
    steps: [
      'Adjust the machine so your knees line up with its pivot point and the pad sits just above your heels.',
      'Curl your heels toward your glutes as far as you can.',
      'Pause, then lower slowly to a full stretch.',
    ],
    cues: ['Slow on the way back (2–3 seconds)', 'Hips stay down on the pad'],
    mistakes: ['Swinging the weight', 'Short half-reps'],
    alts: ['db-rdl', 'back-extension'],
  },
  {
    id: 'leg-extension', name: 'Leg Extension (Machine)', group: 'Legs', equipment: 'Machine', type: 'weight', compound: false,
    muscles: 'Quads', inc: { lb: 5, kg: 2.5 }, level: 1,
    steps: [
      'Adjust the back pad so your knees line up with the machine pivot; the shin pad sits just above your ankles.',
      'Straighten your legs until they are fully extended, squeezing your quads.',
      'Lower slowly back to the start.',
    ],
    cues: ['Hold the handles and stay seated', 'Pause at the top'],
    mistakes: ['Kicking the weight up', 'Letting the stack slam down'],
    alts: ['leg-press', 'split-squat'],
  },
  {
    id: 'hip-thrust', name: 'Hip Thrust', group: 'Legs', equipment: 'Barbell', type: 'weight', compound: true,
    muscles: 'Glutes, hamstrings', inc: { lb: 10, kg: 5 }, level: 1,
    steps: [
      'Sit on the floor with your upper back against a bench. Roll a padded barbell (or a hip-thrust machine pad) over your hips.',
      'Plant your feet flat, about hip-width, knees bent.',
      'Drive through your heels to lift your hips until your body is flat from shoulders to knees.',
      'Squeeze your glutes for a second, then lower under control.',
    ],
    cues: ['Chin tucked, ribs down', 'Shins vertical at the top', 'Use a bar pad'],
    mistakes: ['Arching the lower back instead of using glutes', 'Feet too far forward'],
    alts: ['glute-bridge', 'db-rdl'],
  },
  {
    id: 'glute-bridge', name: 'Glute Bridge', group: 'Legs', equipment: 'Bodyweight', type: 'bodyweight', compound: false,
    muscles: 'Glutes, hamstrings', inc: { lb: 0, kg: 0 }, level: 1,
    steps: [
      'Lie on your back, knees bent, feet flat and hip-width apart.',
      'Press through your heels and lift your hips until your body is straight from shoulders to knees.',
      'Squeeze your glutes at the top, then lower slowly.',
    ],
    cues: ['Ribs down, no lower-back arch', 'Hold 2 seconds at the top'],
    mistakes: ['Pushing through the toes', 'Rushing the reps'],
    alts: ['hip-thrust'],
  },
  {
    id: 'calf-raise', name: 'Standing Calf Raise', group: 'Legs', equipment: 'Machine', type: 'weight', compound: false,
    muscles: 'Calves', inc: { lb: 10, kg: 5 }, level: 1,
    steps: [
      'Stand with the balls of your feet on the edge of the platform (machine, step, or leg press).',
      'Lower your heels for a deep stretch.',
      'Rise up onto your toes as high as you can, pause, and lower slowly.',
    ],
    cues: ['Full stretch at the bottom', 'Pause 1 second at the top'],
    mistakes: ['Bouncing', 'Bending the knees to cheat'],
    alts: ['leg-press'],
  },

  // ---------------- Chest ----------------
  {
    id: 'machine-chest-press', name: 'Machine Chest Press', group: 'Chest', equipment: 'Machine', type: 'weight', compound: true,
    muscles: 'Chest, front shoulders, triceps', inc: { lb: 10, kg: 5 }, level: 1,
    steps: [
      'Adjust the seat so the handles line up with the middle of your chest.',
      'Sit with your back against the pad, shoulder blades pulled back and down.',
      'Press the handles forward until your arms are nearly straight.',
      'Return slowly until you feel a stretch across your chest.',
    ],
    cues: ['Shoulders down, away from your ears', 'Elbows about 45° from your body'],
    mistakes: ['Seat too low or high', 'Shoulders rolling forward at the end'],
    alts: ['db-bench', 'push-up', 'bench-press'],
  },
  {
    id: 'db-bench', name: 'Dumbbell Bench Press', group: 'Chest', equipment: 'Dumbbell', type: 'weight', compound: true, perHand: true,
    muscles: 'Chest, front shoulders, triceps', inc: { lb: 5, kg: 2 }, level: 1,
    steps: [
      'Sit on a flat bench with the dumbbells on your thighs. Lie back and use your knees to help bring them to your chest.',
      'Press the dumbbells up over your chest, palms facing your feet.',
      'Lower them slowly to the sides of your chest, elbows about 45° from your body.',
      'Press back up. To finish, bring them to your chest and sit up with them on your thighs.',
    ],
    cues: ['Feet flat, shoulder blades pinched', 'Dumbbells travel in a slight arc'],
    mistakes: ['Flaring elbows straight out', 'Dropping the dumbbells to the floor from the top'],
    alts: ['machine-chest-press', 'bench-press', 'push-up'],
  },
  {
    id: 'incline-db-press', name: 'Incline Dumbbell Press', group: 'Chest', equipment: 'Dumbbell', type: 'weight', compound: true, perHand: true,
    muscles: 'Upper chest, front shoulders, triceps', inc: { lb: 5, kg: 2 }, level: 1,
    steps: [
      'Set a bench to about 30°. Sit back with dumbbells on your thighs and kick them up to your shoulders.',
      'Press up over your upper chest.',
      'Lower slowly to the sides of your upper chest, then press again.',
    ],
    cues: ['Low incline, not upright', 'Shoulder blades back and down'],
    mistakes: ['Bench too steep (turns into a shoulder press)', 'Bouncing at the bottom'],
    alts: ['db-bench', 'machine-chest-press'],
  },
  {
    id: 'bench-press', name: 'Barbell Bench Press', group: 'Chest', equipment: 'Barbell', type: 'weight', compound: true,
    muscles: 'Chest, front shoulders, triceps', inc: { lb: 5, kg: 2.5 }, level: 2,
    steps: [
      'Lie on the bench with your eyes under the bar. Set safety arms if the bench has them, or use a spotter.',
      'Grip slightly wider than shoulder-width. Pinch your shoulder blades and plant your feet.',
      'Unrack and hold the bar over your shoulders with straight arms.',
      'Lower to your lower chest with elbows about 45° from your body, touch lightly, then press back up.',
    ],
    cues: ['Bar path: lower chest to over the shoulders', 'Wrists stacked over elbows', 'Butt stays on the bench'],
    mistakes: ['Bouncing off the chest', 'Benching heavy alone without safeties', 'Elbows flared to 90°'],
    alts: ['db-bench', 'machine-chest-press'],
  },
  {
    id: 'push-up', name: 'Push-Up', group: 'Chest', equipment: 'Bodyweight', type: 'bodyweight', compound: true,
    muscles: 'Chest, shoulders, triceps, core', inc: { lb: 0, kg: 0 }, level: 1,
    steps: [
      'Hands slightly wider than shoulders, body in a straight line from head to heels.',
      'Lower your chest toward the floor, elbows angled back about 45°.',
      'Push back up to straight arms.',
      'Too hard? Put your hands on a bench or bar (incline push-up). The higher the hands, the easier.',
    ],
    cues: ['Squeeze glutes so hips do not sag', 'Chest leads, not the chin'],
    mistakes: ['Hips sagging or piking up', 'Half-reps'],
    alts: ['machine-chest-press', 'db-bench'],
  },
  {
    id: 'pec-deck', name: 'Pec Deck / Machine Fly', group: 'Chest', equipment: 'Machine', type: 'weight', compound: false,
    muscles: 'Chest', inc: { lb: 5, kg: 2.5 }, level: 1,
    steps: [
      'Adjust the seat so the handles are at chest height.',
      'With a slight bend in your elbows, bring the handles together in front of your chest in a hugging motion.',
      'Open back up slowly until you feel a stretch across the chest.',
    ],
    cues: ['Fixed elbow angle the whole time', 'Squeeze for a second in the middle'],
    mistakes: ['Turning it into a press', 'Going so wide it hurts the shoulders'],
    alts: ['machine-chest-press', 'db-bench'],
  },

  // ---------------- Back ----------------
  {
    id: 'lat-pulldown', name: 'Lat Pulldown', group: 'Back', equipment: 'Cable', type: 'weight', compound: true,
    muscles: 'Lats, upper back, biceps', inc: { lb: 10, kg: 5 }, level: 1,
    steps: [
      'Set the thigh pad so your legs are locked in snugly.',
      'Grip the bar a bit wider than shoulders, palms facing away.',
      'Lean back slightly and pull the bar to your upper chest, driving your elbows down toward your hips.',
      'Let the bar rise slowly until your arms are straight and you feel a stretch in your lats.',
    ],
    cues: ['Chest up to meet the bar', 'Think elbows to back pockets'],
    mistakes: ['Pulling behind the neck', 'Swinging your whole body back', 'Letting the stack crash'],
    alts: ['assisted-pullup', 'seated-cable-row'],
  },
  {
    id: 'seated-cable-row', name: 'Seated Cable Row', group: 'Back', equipment: 'Cable', type: 'weight', compound: true,
    muscles: 'Mid back, lats, rear shoulders, biceps', inc: { lb: 10, kg: 5 }, level: 1,
    steps: [
      'Sit with feet on the platform, knees slightly bent, holding the handle with straight arms.',
      'Sit tall, then pull the handle to your belly button, squeezing your shoulder blades together.',
      'Let your arms straighten slowly and your shoulders reach forward a little for a stretch.',
    ],
    cues: ['Torso stays mostly still', 'Lead with the elbows', 'Pause with the handle touching your stomach'],
    mistakes: ['Rocking back and forth to move the weight', 'Shrugging toward the ears'],
    alts: ['chest-supported-row', 'db-row'],
  },
  {
    id: 'db-row', name: 'One-Arm Dumbbell Row', group: 'Back', equipment: 'Dumbbell', type: 'weight', compound: true, perHand: true,
    muscles: 'Lats, mid back, biceps', inc: { lb: 5, kg: 2 }, level: 1, unilateral: true,
    steps: [
      'Place one knee and the same-side hand on a flat bench. Back flat, like a tabletop.',
      'Hold a dumbbell in the other hand with your arm hanging straight down.',
      'Pull the dumbbell toward your hip, keeping your elbow close to your body.',
      'Lower slowly to a full stretch. Finish the reps, then switch sides.',
    ],
    cues: ['Pull to the hip, not the armpit', 'Do not twist your torso open'],
    mistakes: ['Jerking the weight with your back', 'Rounding the back'],
    alts: ['seated-cable-row', 'chest-supported-row'],
  },
  {
    id: 'chest-supported-row', name: 'Chest-Supported Row', group: 'Back', equipment: 'Machine', type: 'weight', compound: true,
    muscles: 'Mid back, lats, rear shoulders', inc: { lb: 10, kg: 5 }, level: 1,
    steps: [
      'Set the chest pad so you can just reach the handles with straight arms.',
      'Keep your chest on the pad and pull the handles back, squeezing your shoulder blades together.',
      'Return slowly to a full stretch.',
    ],
    cues: ['Chest stays on the pad', 'Pause at the squeeze'],
    mistakes: ['Lifting your chest off to cheat', 'Short range of motion'],
    alts: ['seated-cable-row', 'db-row'],
  },
  {
    id: 'assisted-pullup', name: 'Assisted Pull-Up', group: 'Back', equipment: 'Machine', type: 'assisted', compound: true,
    muscles: 'Lats, upper back, biceps', inc: { lb: 10, kg: 5 }, level: 1,
    steps: [
      'Choose the assistance weight on the stack. More assistance makes it easier.',
      'Kneel or stand on the pad and grip the handles just wider than your shoulders.',
      'Pull your chest toward the bar until your chin clears it.',
      'Lower slowly to straight arms.',
    ],
    cues: ['Log the assistance weight: lower number = stronger', 'Shoulders down before you pull'],
    mistakes: ['Half reps', 'Kicking to get up'],
    alts: ['lat-pulldown'],
  },
  {
    id: 'face-pull', name: 'Face Pull', group: 'Back', equipment: 'Cable', type: 'weight', compound: false,
    muscles: 'Rear shoulders, upper back, rotator cuff', inc: { lb: 5, kg: 2.5 }, level: 1,
    steps: [
      'Set a rope attachment on a cable at face height.',
      'Hold the rope with thumbs pointing back and step back until your arms are straight.',
      'Pull the rope toward your face, splitting it apart so your hands end beside your ears.',
      'Return slowly.',
    ],
    cues: ['Elbows high', 'Finish like a double-biceps pose'],
    mistakes: ['Going too heavy and leaning back', 'Pulling to the chest'],
    alts: ['rear-delt-fly'],
  },
  {
    id: 'back-extension', name: 'Back Extension', group: 'Back', equipment: 'Bodyweight', type: 'bodyweight', compound: false,
    muscles: 'Lower back, glutes, hamstrings', inc: { lb: 5, kg: 2.5 }, level: 1,
    steps: [
      'Set the 45° bench so the pad sits just below your hip bones.',
      'Cross your arms over your chest and hinge down, keeping your back flat.',
      'Squeeze your glutes to raise your body until it is in a straight line. Do not arch past that.',
    ],
    cues: ['Hinge at the hips', 'Stop at straight, no over-arching'],
    mistakes: ['Hyperextending at the top', 'Swinging fast'],
    alts: ['db-rdl', 'glute-bridge'],
  },

  // ---------------- Shoulders ----------------
  {
    id: 'db-shoulder-press', name: 'Seated Dumbbell Shoulder Press', group: 'Shoulders', equipment: 'Dumbbell', type: 'weight', compound: true, perHand: true,
    muscles: 'Shoulders, triceps', inc: { lb: 5, kg: 2 }, level: 1,
    steps: [
      'Set a bench upright. Sit with your back against it and dumbbells at shoulder height, palms forward.',
      'Press the dumbbells overhead until your arms are straight.',
      'Lower slowly back to shoulder height.',
    ],
    cues: ['Ribs down, back on the pad', 'Dumbbells over your elbows the whole time'],
    mistakes: ['Arching your lower back', 'Banging the dumbbells together at the top'],
    alts: ['machine-shoulder-press', 'ohp'],
  },
  {
    id: 'machine-shoulder-press', name: 'Machine Shoulder Press', group: 'Shoulders', equipment: 'Machine', type: 'weight', compound: true,
    muscles: 'Shoulders, triceps', inc: { lb: 10, kg: 5 }, level: 1,
    steps: [
      'Adjust the seat so the handles start at about shoulder height.',
      'Press overhead until your arms are nearly straight.',
      'Lower slowly back to the start.',
    ],
    cues: ['Back flat against the pad', 'Smooth and controlled'],
    mistakes: ['Seat too low', 'Shrugging into your ears'],
    alts: ['db-shoulder-press', 'ohp'],
  },
  {
    id: 'ohp', name: 'Barbell Overhead Press', group: 'Shoulders', equipment: 'Barbell', type: 'weight', compound: true,
    muscles: 'Shoulders, triceps, upper back, core', inc: { lb: 5, kg: 2.5 }, level: 2,
    steps: [
      'Set the bar in a rack at upper-chest height. Grip just outside your shoulders.',
      'Unrack it so it rests on your front shoulders. Feet hip-width, glutes squeezed.',
      'Press the bar straight up, moving your head back slightly to let it pass, then push your head through once it clears.',
      'Lower it back to your shoulders under control.',
    ],
    cues: ['Squeeze glutes and brace so you do not lean back', 'Bar finishes over the middle of your head'],
    mistakes: ['Leaning way back', 'Pressing the bar forward around your face'],
    alts: ['db-shoulder-press', 'machine-shoulder-press'],
  },
  {
    id: 'lateral-raise', name: 'Dumbbell Lateral Raise', group: 'Shoulders', equipment: 'Dumbbell', type: 'weight', compound: false, perHand: true,
    muscles: 'Side shoulders', inc: { lb: 2.5, kg: 1 }, level: 1,
    steps: [
      'Stand holding light dumbbells at your sides.',
      'With a slight bend in your elbows, raise your arms out to the sides until they reach shoulder height.',
      'Lower slowly.',
    ],
    cues: ['Lead with the elbows', 'Light weight, strict form', 'Pinkies do not need to tip up'],
    mistakes: ['Swinging the weights up', 'Shrugging'],
    alts: ['face-pull'],
  },
  {
    id: 'rear-delt-fly', name: 'Reverse Pec Deck', group: 'Shoulders', equipment: 'Machine', type: 'weight', compound: false,
    muscles: 'Rear shoulders, upper back', inc: { lb: 5, kg: 2.5 }, level: 1,
    steps: [
      'Sit facing the pec deck pad, handles set to the rear position.',
      'With straight arms, sweep the handles back and out to your sides.',
      'Return slowly.',
    ],
    cues: ['Think pushing out wide, not squeezing back', 'Light and controlled'],
    mistakes: ['Using momentum'],
    alts: ['face-pull'],
  },

  // ---------------- Arms ----------------
  {
    id: 'db-curl', name: 'Dumbbell Curl', group: 'Arms', equipment: 'Dumbbell', type: 'weight', compound: false, perHand: true,
    muscles: 'Biceps', inc: { lb: 5, kg: 2 }, level: 1,
    steps: [
      'Stand tall with a dumbbell in each hand, palms facing forward.',
      'Curl the weights up toward your shoulders, keeping your elbows by your sides.',
      'Lower slowly to straight arms.',
    ],
    cues: ['Elbows stay pinned', 'Control the way down'],
    mistakes: ['Swinging your back', 'Half reps'],
    alts: ['hammer-curl'],
  },
  {
    id: 'hammer-curl', name: 'Hammer Curl', group: 'Arms', equipment: 'Dumbbell', type: 'weight', compound: false, perHand: true,
    muscles: 'Biceps, forearms', inc: { lb: 5, kg: 2 }, level: 1,
    steps: [
      'Hold dumbbells at your sides with palms facing each other.',
      'Curl up while keeping that neutral grip.',
      'Lower slowly.',
    ],
    cues: ['Thumbs up the whole way', 'No swinging'],
    mistakes: ['Elbows drifting forward'],
    alts: ['db-curl'],
  },
  {
    id: 'triceps-pushdown', name: 'Cable Triceps Pushdown', group: 'Arms', equipment: 'Cable', type: 'weight', compound: false,
    muscles: 'Triceps', inc: { lb: 5, kg: 2.5 }, level: 1,
    steps: [
      'Attach a rope or straight bar to a high cable.',
      'Elbows by your sides, push the handle down until your arms are straight.',
      'Let it rise slowly until your forearms are just above parallel.',
    ],
    cues: ['Only the forearms move', 'Spread the rope at the bottom'],
    mistakes: ['Leaning over the weight', 'Elbows flaring out'],
    alts: ['overhead-triceps'],
  },
  {
    id: 'overhead-triceps', name: 'Overhead Triceps Extension', group: 'Arms', equipment: 'Dumbbell', type: 'weight', compound: false,
    muscles: 'Triceps (long head)', inc: { lb: 5, kg: 2 }, level: 1,
    steps: [
      'Sit on an upright bench holding one dumbbell overhead with both hands.',
      'Lower it behind your head by bending your elbows.',
      'Straighten your arms to lift it back up.',
    ],
    cues: ['Elbows point forward, not out', 'Ribs down'],
    mistakes: ['Arching your back'],
    alts: ['triceps-pushdown'],
  },

  // ---------------- Core ----------------
  {
    id: 'plank', name: 'Plank', group: 'Core', equipment: 'Bodyweight', type: 'time', compound: false,
    muscles: 'Abs, deep core, shoulders', inc: { lb: 0, kg: 0 }, level: 1,
    steps: [
      'Forearms on the floor, elbows under shoulders.',
      'Step your feet back so your body is a straight line from head to heels.',
      'Squeeze glutes and brace your abs like someone is about to poke your stomach. Breathe and hold.',
    ],
    cues: ['Straight line, no sagging hips', 'Breathe normally'],
    mistakes: ['Hips too high or sagging', 'Holding your breath'],
    alts: ['dead-bug', 'side-plank'],
  },
  {
    id: 'side-plank', name: 'Side Plank', group: 'Core', equipment: 'Bodyweight', type: 'time', compound: false,
    muscles: 'Obliques, hips', inc: { lb: 0, kg: 0 }, level: 1, unilateral: true,
    steps: [
      'Lie on your side with your elbow under your shoulder, legs stacked.',
      'Lift your hips so your body forms a straight line.',
      'Hold, then switch sides. Make it easier by bending your knees.',
    ],
    cues: ['Hips forward and high', 'Time is per side'],
    mistakes: ['Hips sagging or rotating'],
    alts: ['plank', 'pallof-press'],
  },
  {
    id: 'dead-bug', name: 'Dead Bug', group: 'Core', equipment: 'Bodyweight', type: 'bodyweight', compound: false,
    muscles: 'Deep core', inc: { lb: 0, kg: 0 }, level: 1, unilateral: true,
    steps: [
      'Lie on your back with arms reaching to the ceiling and knees bent 90° over your hips.',
      'Press your lower back into the floor.',
      'Slowly lower your right arm overhead and your left leg toward the floor at the same time.',
      'Return and switch sides. Reps are per side.',
    ],
    cues: ['Lower back stays flat on the floor', 'Exhale as you reach'],
    mistakes: ['Back arching off the floor', 'Rushing'],
    alts: ['plank', 'bird-dog'],
  },
  {
    id: 'bird-dog', name: 'Bird Dog', group: 'Core', equipment: 'Bodyweight', type: 'bodyweight', compound: false,
    muscles: 'Core, lower back, glutes', inc: { lb: 0, kg: 0 }, level: 1, unilateral: true,
    steps: [
      'Start on hands and knees, hands under shoulders, knees under hips.',
      'Reach one arm forward and the opposite leg back until both are straight.',
      'Hold for a breath, return, and switch. Reps are per side.',
    ],
    cues: ['Imagine a glass of water on your lower back', 'Slow and steady'],
    mistakes: ['Twisting the hips open'],
    alts: ['dead-bug'],
  },
  {
    id: 'pallof-press', name: 'Pallof Press', group: 'Core', equipment: 'Cable', type: 'weight', compound: false,
    muscles: 'Obliques, deep core (anti-rotation)', inc: { lb: 5, kg: 2.5 }, level: 1, unilateral: true,
    steps: [
      'Set a cable handle at chest height. Stand side-on to the machine, holding the handle at your chest.',
      'Step out until there is tension. Feet shoulder-width, knees soft.',
      'Press the handle straight out in front of you and resist the cable pulling you around.',
      'Bring it back to your chest. Finish reps, then face the other way.',
    ],
    cues: ['Do not let the cable twist you', 'Reps are per side'],
    mistakes: ['Standing too close (no tension)', 'Leaning away'],
    alts: ['side-plank'],
  },
  {
    id: 'hanging-knee-raise', name: 'Hanging Knee Raise', group: 'Core', equipment: 'Bodyweight', type: 'bodyweight', compound: false,
    muscles: 'Lower abs, hip flexors, grip', inc: { lb: 0, kg: 0 }, level: 2,
    steps: [
      'Hang from a pull-up bar, or use the arm-rest station (captain\'s chair).',
      'Curl your knees up toward your chest, rolling your pelvis up.',
      'Lower slowly without swinging.',
    ],
    cues: ['Control the swing', 'Curl the pelvis, do not just lift the legs'],
    mistakes: ['Kipping/swinging'],
    alts: ['dead-bug', 'cable-crunch'],
  },
  {
    id: 'cable-crunch', name: 'Cable Crunch', group: 'Core', equipment: 'Cable', type: 'weight', compound: false,
    muscles: 'Abs', inc: { lb: 5, kg: 2.5 }, level: 1,
    steps: [
      'Attach a rope to a high cable. Kneel facing it, holding the rope beside your head.',
      'Crunch down by curling your ribs toward your hips.',
      'Return slowly, keeping your hips still.',
    ],
    cues: ['Curl the spine, do not just bend at the hips', 'Exhale hard as you crunch'],
    mistakes: ['Pulling with the arms', 'Sitting back onto your heels'],
    alts: ['dead-bug', 'hanging-knee-raise'],
  },
  {
    id: 'farmers-carry', name: "Farmer's Carry", group: 'Core', equipment: 'Dumbbell', type: 'weight_time', compound: true, perHand: true,
    muscles: 'Grip, core, traps, everything', inc: { lb: 5, kg: 2 }, level: 1,
    steps: [
      'Pick up a heavy dumbbell in each hand with a proper squat or hinge.',
      'Stand tall and walk with short, steady steps for the set time.',
      'Set them down carefully.',
    ],
    cues: ['Tall posture, shoulders down', 'Tight grip, steady breathing'],
    mistakes: ['Leaning to one side', 'Rounding forward'],
    alts: ['plank'],
  },

  // ---------------- Cardio ----------------
  {
    id: 'treadmill', name: 'Treadmill (walk or jog)', group: 'Cardio', equipment: 'Cardio machine', type: 'cardio', compound: false,
    muscles: 'Heart and lungs, legs', inc: { lb: 0, kg: 0 }, level: 1,
    steps: [
      'Start walking at an easy pace. Clip on the safety key.',
      'Build up to a pace where you can talk but not sing (Zone 2).',
      'An incline of 3–8% makes walking much harder without impact.',
    ],
    cues: ['Do not hold the rails', 'Easy days should feel easy'],
    mistakes: ['Holding the handrails on an incline'],
    alts: ['bike', 'elliptical', 'rower'],
  },
  {
    id: 'bike', name: 'Stationary Bike', group: 'Cardio', equipment: 'Cardio machine', type: 'cardio', compound: false,
    muscles: 'Heart and lungs, quads', inc: { lb: 0, kg: 0 }, level: 1,
    steps: [
      'Set the seat so your knee is slightly bent at the bottom of the pedal stroke.',
      'Pedal at an easy-to-moderate resistance.',
    ],
    cues: ['Smooth circles', 'Great low-impact warm-up'],
    mistakes: ['Seat too low (knees ache)'],
    alts: ['treadmill', 'elliptical'],
  },
  {
    id: 'rower', name: 'Rowing Machine', group: 'Cardio', equipment: 'Cardio machine', type: 'cardio', compound: false,
    muscles: 'Heart and lungs, legs, back', inc: { lb: 0, kg: 0 }, level: 1,
    steps: [
      'Strap your feet in. Damper around 3–5.',
      'Push with your legs first, then lean back slightly, then pull the handle to your lower ribs.',
      'Return in reverse: arms, body, then legs.',
    ],
    cues: ['Legs, body, arms … arms, body, legs', 'Most of the power comes from the legs'],
    mistakes: ['Pulling with the arms first', 'Damper on 10'],
    alts: ['bike', 'treadmill'],
  },
  {
    id: 'elliptical', name: 'Elliptical', group: 'Cardio', equipment: 'Cardio machine', type: 'cardio', compound: false,
    muscles: 'Heart and lungs, legs', inc: { lb: 0, kg: 0 }, level: 1,
    steps: ['Step on, hold the handles, and stride at a steady, comfortable pace.'],
    cues: ['Stand tall', 'Push and pull the handles'],
    mistakes: ['Leaning on the handles'],
    alts: ['bike', 'treadmill'],
  },
  {
    id: 'stair-climber', name: 'Stair Climber', group: 'Cardio', equipment: 'Cardio machine', type: 'cardio', compound: false,
    muscles: 'Heart and lungs, glutes, legs', inc: { lb: 0, kg: 0 }, level: 1,
    steps: ['Start slow. Step with your whole foot and stand tall.'],
    cues: ['Light touch on the rails only for balance'],
    mistakes: ['Hanging on the rails'],
    alts: ['treadmill', 'bike'],
  },
];

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));
let customList = [];

/** Exercises the user created; the app keeps this in sync with storage. */
export function setCustomExercises(list) { customList = Array.isArray(list) ? list : []; }

export function getExercise(id) {
  return BY_ID.get(id) || customList.find((c) => c.id === id) || null;
}

export function allExercises() {
  return [...EXERCISES, ...customList];
}
