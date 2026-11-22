(function () {
  const PROGRAMS = {
    ccsp: "Community Care Services Program (CCSP)",
    icwp: "Independent Care Waiver Program (ICWP)"
  };
  const VISITS = {
    initial: "Initial nursing assessment",
    bimonthly: "Bi-monthly nursing assessment"
  };

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function slug(value) {
    return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  function textField(name, label, type, required, wide, placeholder) {
    return '<div data-field data-label="' + esc(label) + '" class="' + (wide ? "wide" : "") + '"><label>' + esc(label) +
      (required ? ' <span class="req">Required</span>' : "") +
      '<input name="' + esc(name) + '" type="' + (type || "text") + '"' +
      (required ? " required" : "") + ' autocomplete="off"' +
      (placeholder ? ' placeholder="' + esc(placeholder) + '"' : "") + "></label></div>";
  }

  function areaField(name, label, wide) {
    return '<div data-field data-label="' + esc(label) + '" class="wide"><label>' + esc(label) +
      '<textarea name="' + esc(name) + '" rows="3" autocomplete="off"></textarea></label></div>';
  }

  function checks(name, label, options) {
    const boxes = options.map(function (option, index) {
      return '<label class="choice"><input type="checkbox" name="' + esc(name) + '" value="' + esc(option) + '"> ' + esc(option) + "</label>";
    }).join("");
    return '<div data-field data-kind="checks" data-label="' + esc(label) + '" class="wide"><span class="field-label">' + esc(label) + '</span><div class="choices">' + boxes + "</div></div>";
  }

  function radios(name, label, options, required) {
    const boxes = options.map(function (option) {
      return '<label class="choice"><input type="radio" name="' + esc(name) + '" value="' + esc(option) + '"' + (required ? " required" : "") + "> " + esc(option) + "</label>";
    }).join("");
    return '<div data-field data-kind="radio" data-label="' + esc(label) + '" class="wide"><span class="field-label">' + esc(label) + "</span>" + boxes + "</div>";
  }

  function yesno(name, label) {
    return radios(name, label, ["Yes", "No"], false);
  }

  function sideChecks(label, prefix, words) {
    const options = [];
    words.forEach(function (word) {
      options.push(word + ", right");
      options.push(word + ", left");
    });
    return checks(prefix, label, options);
  }

  const sections = [
    ["Client", [
      textField("client_name", "Name of client", "text", true, true),
      textField("client_address", "Address of client", "text", false, true),
      textField("client_phone", "Phone number", "tel", false, false),
      textField("mrn", "MR #", "text", false, false),
      textField("allergies", "Allergies (if any)", "text", false, true, "Write NKDA if none are known"),
      textField("visit_date", "Date of assessment", "date", true, false)
    ]],
    ["Vital signs", [
      textField("temperature", "Temperature", "text", false, false, "°F"),
      radios("temp_route", "Temperature route", ["Oral", "Rectal", "Axillary"], false),
      textField("apical_pulse", "Apical pulse", "text", false, false),
      textField("radial_pulse", "Radial pulse", "text", false, false),
      radios("pulse_rhythm", "Pulse rhythm", ["Regular", "Irregular"], false),
      textField("respirations", "Respirations", "text", false, false),
      textField("weight", "Weight", "text", false, false, "lb"),
      textField("height", "Height", "text", false, false, "ft / in"),
      textField("blood_sugar", "Blood sugar", "text", false, false, "mg/dL"),
      radios("sugar_timing", "Blood sugar timing", ["Random", "Fasting"], false),
      '<div class="wide"><span class="field-label">Blood pressure</span><div class="table-wrap"><table class="bp"><thead><tr><th></th><th>Left</th><th>Right</th></tr></thead><tbody>' +
        ["Supine", "Sitting", "Standing"].map(function (pos) {
          const key = pos.toLowerCase();
          return "<tr><th>" + pos + "</th><td>" +
            '<div data-field data-label="Blood pressure, ' + key + ', left"><input name="bp_' + key + '_l" aria-label="' + pos + ' blood pressure, left arm" placeholder="120/80" autocomplete="off"></div></td><td>' +
            '<div data-field data-label="Blood pressure, ' + key + ', right"><input name="bp_' + key + '_r" aria-label="' + pos + ' blood pressure, right arm" placeholder="120/80" autocomplete="off"></div></td></tr>';
        }).join("") +
        "</tbody></table></div></div>"
    ]],
    ["Cardiovascular", [
      checks("cv_rhythm", "Rhythm", ["Regular rhythm", "Irregular rhythm"]),
      areaField("cv_rhythm_describe", "Describe the rhythm"),
      checks("cv_rate", "Rate", ["Bradycardia / tachycardia"]),
      yesno("cv_symptomatic", "Symptomatic?"),
      areaField("cv_symptom_describe", "Describe symptoms"),
      checks("cv_findings", "Findings", ["Murmur / rub", "Syncope / vertigo", "Orthopnea"]),
      areaField("cv_findings_describe", "Describe murmur, syncope, or orthopnea"),
      '<h3 class="subhead wide">Pacemaker</h3>',
      textField("pacemaker_demand", "Demand rate", "text", false, false),
      textField("pacemaker_fixed", "Fixed rate", "text", false, false),
      textField("pacemaker_magnet", "Magnet rate", "text", false, false),
      '<h3 class="subhead wide">Chest pain</h3>',
      checks("chest_pain_when", "Chest pain", ["This visit", "By history"]),
      textField("cp_location", "Location", "text", false, false),
      textField("cp_frequency", "Frequency", "text", false, false),
      textField("cp_relief", "Relief measures", "text", false, true),
      checks("cp_quality", "Description", ["Dull", "Sharp", "Achy", "Tight", "Pressure", "Radiating"]),
      checks("cp_radiation", "Radiation", ["Arm", "Jaw"]),
      textField("cp_radiation_other", "Other radiation", "text", false, true),
      checks("cp_precip", "Precipitating factors", ["Resting", "Exertion", "Eating", "Stress"]),
      textField("cp_precip_other", "Other precipitating factors", "text", false, true),
      radios("cap_refill", "Capillary refill", ["Less than 3 seconds", "More than 3 seconds"], false),
      checks("pedal", "Pedal pulses palpable", ["Right", "Left"]),
      checks("vascular", "Vascular findings", ["DVT", "Varicose veins", "Claudication / numbness / tingling"]),
      areaField("vascular_describe", "Describe vascular findings"),
      checks("edema_grade", "Edema", ["1+", "2+", "3+", "4+"]),
      textField("edema_location", "Edema location", "text", false, false),
      textField("edema_measure", "Edema measurement", "text", false, false),
      checks("hose", "Anti-embolism hose", ["Has anti-embolism hose", "Needs anti-embolism hose"]),
      areaField("cv_additional", "Additional cardiovascular findings")
    ]],
    ["Respiratory", [
      sideChecks("Lung auscultation", "lungs", ["Clear", "Rales / rhonchi", "Wheezes", "Other"]),
      areaField("lungs_other", "Describe other breath sounds"),
      checks("breathing", "Breathing", ["Shallow", "Labored", "Barrel chest"]),
      areaField("cyanosis", "Cyanosis — describe"),
      textField("o2_rate", "Oxygen therapy rate", "text", false, false),
      textField("o2_route", "Oxygen route", "text", false, false),
      textField("o2_frequency", "Oxygen frequency", "text", false, false),
      textField("nebulizer", "Nebulizer frequency", "text", false, false),
      textField("trach_type", "Tracheostomy type", "text", false, false),
      textField("trach_size", "Tracheostomy size", "text", false, false),
      textField("vent_type", "Ventilator type", "text", false, false),
      textField("vent_rate", "Ventilator rate", "text", false, false),
      textField("vent_tv", "Tidal volume", "text", false, false),
      textField("vent_fio2", "FiO2 %", "text", false, false),
      yesno("vent_generator", "Backup generator"),
      areaField("resp_additional", "Additional respiratory findings")
    ]],
    ["Musculoskeletal", [
      textField("amputation", "Amputation", "text", false, false),
      textField("deformity", "Deformity", "text", false, false),
      textField("appliance", "Appliance", "text", false, false),
      textField("prosthesis", "Prosthesis", "text", false, false),
      textField("swelling", "Swelling", "text", false, false),
      textField("ms_paralysis", "Paralysis", "text", false, false),
      textField("contractures", "Contractures", "text", false, true),
      radios("rom", "Range of motion", ["Within normal limits", "Limited"], false),
      textField("rom_limited", "Describe limited range of motion", "text", false, true),
      checks("ms_flags", "Musculoskeletal findings", ["Spasms", "Atrophy", "Weakness", "Osteoporosis", "Falls", "Fractures", "Abnormal gait"]),
      textField("immobility", "Immobility", "text", false, true),
      areaField("ms_additional", "Additional musculoskeletal findings")
    ]],
    ["Neurological", [
      radios("loc", "Level of consciousness", ["Alert", "Lethargic", "Semi-comatose", "Comatose"], false),
      checks("orientation", "Orientation", ["Person", "Place", "Time", "Forgetful", "Disoriented"]),
      checks("neuro_flags", "Deficits", ["Vertigo", "Unsteady gait", "Slurred speech", "Facial drooping"]),
      checks("tremors", "Tremors", ["Fine", "Gross"]),
      checks("grip_weak", "Weak grip", ["Right", "Left"]),
      checks("grip_absent", "Absent grip", ["Right", "Left"]),
      '<p class="hint wide">RUE is the right arm, LUE the left arm, RLE the right leg, and LLE the left leg.</p>',
      checks("weakness", "Weakness", ["RUE", "LUE", "RLE", "LLE"]),
      checks("paralysis", "Paralysis", ["RUE", "LUE", "RLE", "LLE"]),
      textField("seizure_type", "Seizure type", "text", false, false),
      textField("seizure_frequency", "Seizure frequency", "text", false, false),
      textField("seizure_last", "Date of last seizure", "date", false, false),
      areaField("neuro_additional", "Additional neurological findings")
    ]],
    ["Eyes, ears, nose, and throat", [
      '<h3 class="subhead wide">Eyes</h3>',
      checks("eyes", "Eyes", ["PERRLA", "Glaucoma", "Retinopathy"]),
      checks("blind", "Blind", ["Right", "Left"]),
      checks("eye_drainage", "Eye drainage", ["Right", "Left"]),
      textField("eye_drainage_describe", "Describe eye drainage", "text", false, true),
      checks("cataracts", "Cataracts", ["Right", "Left"]),
      checks("blurred", "Blurred vision", ["Right", "Left"]),
      checks("sclera", "Jaundiced sclera", ["Right", "Left"]),
      areaField("eyes_additional", "Additional eye findings"),
      '<h3 class="subhead wide">Ears</h3>',
      checks("ears", "Ears", ["Tinnitus", "Deaf", "Otitis", "Excess cerumen"]),
      textField("ear_drainage", "Ear drainage", "text", false, true),
      checks("hoh", "Hard of hearing", ["Right", "Left"]),
      checks("hearing_aid", "Hearing aid", ["Right", "Left"]),
      areaField("ears_additional", "Additional ear findings"),
      '<h3 class="subhead wide">Nose</h3>',
      checks("nose", "Nose", ["Rhinitis", "Epistaxis", "Sinusitis"]),
      textField("smell", "Altered smell", "text", false, true),
      textField("env_allergies", "Environmental allergies", "text", false, true),
      areaField("nose_additional", "Additional nose findings"),
      '<h3 class="subhead wide">Throat and mouth</h3>',
      checks("dentures", "Dentures", ["Upper", "Lower", "Partials", "No teeth"]),
      checks("mouth", "Mouth and throat", ["Sore throat", "Bleeding gums", "Dysphagia", "Altered taste", "Mucosa dry", "Gingivitis", "Thrush"]),
      textField("lesions", "Lesions", "text", false, true),
      areaField("mouth_additional", "Additional mouth and throat findings")
    ]],
    ["Gastrointestinal", [
      checks("abdomen", "Abdomen", ["Soft", "Tender", "Distention", "Rigid"]),
      checks("gi_symptoms", "Symptoms", ["Vomiting", "Tarry stools", "Incontinent", "Impaction", "Cramping", "Nausea", "Ascites", "Flatulence", "Constipation", "Rectal bleeding", "Abdominal pain"]),
      checks("bowel_sounds", "Bowel sounds", ["Normal", "Hypoactive", "Hyperactive", "Present"]),
      textField("bowel_quadrants", "Bowel-sound quadrants", "text", false, true),
      checks("bowel_habits", "Bowel habits", ["Constipation", "Incontinence", "Diarrhea", "Laxative / enema dependent"]),
      textField("last_bm", "Last bowel movement", "text", false, true),
      yesno("ostomy", "Ostomy"),
      checks("ostomy_independent", "Ostomy care", ["Independent care"]),
      textField("ostomy_location", "Ostomy location", "text", false, false),
      textField("ostomy_type", "Ostomy type", "text", false, false),
      textField("ostomy_duration", "Ostomy duration", "text", false, false),
      textField("ostomy_appliance", "Ostomy appliance", "text", false, false),
      checks("stoma", "Stoma", ["RUQ", "LUQ", "RLQ", "LLQ"]),
      radios("appetite", "Appetite", ["Good", "Fair", "Poor"], false),
      areaField("gi_additional", "Additional gastrointestinal findings")
    ]],
    ["Genitourinary", [
      textField("urine_color", "Urine color", "text", false, false),
      textField("urine_odor", "Urine odor", "text", false, false),
      checks("gu_symptoms", "Symptoms", ["Nocturia", "Hesitancy", "Itching", "Sediment", "Difficulty with stream", "Odor", "Frequency", "Urgency", "Burning", "Poor perineal hygiene", "Hematuria", "Distension", "Neurogenic bladder", "Retention", "Hemo / peritoneal dialysis", "Incontinent", "Indwelling catheter", "Intermittent catheter", "Nephrostomy tube", "Ileal conduit", "Suprapubic catheter"]),
      textField("cath_type", "Catheter type", "text", false, false),
      textField("cath_size", "Catheter size", "text", false, false),
      textField("cath_balloon", "Balloon", "text", false, false),
      textField("cath_changed", "Last changed", "date", false, false),
      textField("cath_frequency", "Frequency of change", "text", false, false),
      textField("irrig_solution", "Irrigation solution", "text", false, false),
      textField("irrig_frequency", "Irrigation frequency", "text", false, false),
      textField("irrig_amount", "Irrigation amount", "text", false, false),
      checks("urine_bag", "Drainage bag", ["Bedside bag", "Leg bag"]),
      areaField("gu_additional", "Additional genitourinary findings")
    ]],
    ["Endocrine", [
      checks("dm_history", "Diabetes history", ["Type 1", "Type 2", "Gestational", "Not applicable"]),
      textField("dm_onset", "Onset date", "date", false, false),
      textField("rbs", "Random blood sugar", "text", false, false),
      textField("a1c", "Hemoglobin A1C", "text", false, false),
      textField("a1c_date", "A1C date", "date", false, false),
      radios("health_rating", "General health rating", ["Excellent", "Good", "Fair", "Poor"], false),
      checks("dm_monitor", "Glucose monitoring", ["Blood", "Urine"]),
      textField("dm_times", "Times of testing", "text", false, true),
      yesno("dka", "Recent DKA / HHNK"),
      textField("dka_when", "If yes, when", "text", false, true),
      yesno("hyper", "Hyperglycemia (blood sugar above 250)"),
      textField("hyper_detail", "How often / last episode of hyperglycemia", "text", false, true),
      yesno("hypo", "Hypoglycemia"),
      textField("hypo_detail", "How often / last episode of hypoglycemia", "text", false, true),
      checks("dm_chronic", "Chronic complications", ["Retinopathy", "Neuropathy", "Foot problems", "Frequent infections"]),
      textField("retina_exam", "Date of last retina exam", "date", false, false),
      textField("foot_exam", "Date of last foot exam", "date", false, false),
      areaField("meal_plan", "Meals, eating schedule, and current meal plan"),
      yesno("dm_education", "Diabetic education"),
      areaField("dm_education_describe", "Describe diabetic education"),
      areaField("endo_additional", "Additional endocrine findings")
    ]],
    ["Integumentary", [
      radios("turgor", "Turgor", ["Good", "Fair", "Poor"], false),
      checks("skin_color", "Color", ["Within normal limits", "Ashen", "Pale", "Cyanotic", "Jaundiced", "Flushed"]),
      checks("skin_condition", "Condition", ["Warm", "Dry", "Cool", "Diaphoretic"]),
      textField("skin_condition_other", "Other skin condition", "text", false, true),
      checks("skin_symptoms", "Skin findings", ["None", "Rash", "Itching", "Excoriated", "Erythema", "Nail abnormality", "Rubor", "Mottled", "Lesions", "Petechia", "Ecchymosis", "Bruises easily", "Vesicles", "Psoriasis"]),
      textField("skin_location", "Location and description", "text", false, true),
      areaField("skin_additional", "Additional skin findings")
    ]],
    ["Pain", [
      radios("pain_score", "Pain score, 0 is no pain and 10 is the worst pain", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"], false),
      textField("pain_location", "Location and duration", "text", false, true),
      textField("pain_character", "Character", "text", false, false),
      textField("pain_frequency", "Frequency", "text", false, false),
      textField("pain_precip", "Precipitating factors", "text", false, true),
      textField("pain_associated", "Associated symptoms", "text", false, true),
      textField("pain_relief", "Relief measures", "text", false, true),
      textField("pain_effect", "Effectiveness", "text", false, true),
      areaField("pain_other", "Other pain findings")
    ]],
    ["Clinical impression", [
      areaField("frail", "Is the client medically frail or compromised? Please comment."),
      areaField("other_findings", "Other clinical findings"),
      '<div data-field data-kind="signature" data-label="RN signature and credential" class="wide"><div class="fields"><label>RN name and credential <span class="req">Required</span><input data-sig-name name="rn_name" required autocomplete="off"></label><label>Signature date <span class="req">Required</span><input data-sig-date name="rn_date" type="date" required></label></div><p class="hint">Sign with a finger or mouse. The typed name is the credential line from the paper form.</p><canvas aria-label="Signature"></canvas><button type="button" class="btn btn-ghost btn-sm" data-sig-clear>Clear signature</button></div>'
    ]]
  ];

  function render(program, visit) {
    const programName = PROGRAMS[program];
    const visitName = VISITS[visit];
    const root = document.getElementById("form-root");
    if (!programName || !visitName || (program === "ccsp" && visit === "bimonthly")) {
      root.innerHTML = '<div class="page-intro"><p class="eyebrow">Clinical staff</p><h1>Nursing assessments</h1><p class="lede">Choose the form that matches the waiver and the visit. CCSP supervisory visits have their own note.</p></div><div class="card-grid">' +
        '<a class="card" href="/assessment.html?program=ccsp&visit=initial"><h2>CCSP initial</h2><p>First nursing assessment for Community Care Services Program personal support.</p></a>' +
        '<a class="card" href="/assessment.html?program=icwp&visit=initial"><h2>ICWP initial</h2><p>First nursing assessment for the Independent Care Waiver Program.</p></a>' +
        '<a class="card" href="/assessment.html?program=icwp&visit=bimonthly"><h2>ICWP RN supervisory visit notes</h2><p>The follow-up nursing assessment for an ICWP client.</p></a>' +
        '<a class="card" href="/supervisory.html"><h2>CCSP RN supervisory visit notes</h2><p>Supervisory visit and progress notes, including the care coordinator communication.</p></a></div>';
      return;
    }
    const formId = "assessment-" + program + "-" + (visit === "bimonthly" ? "bimonthly" : "initial");
    const title = visitName + " — " + programName;
    const nav = sections.map(function (section) {
      return '<a href="#' + slug(section[0]) + '">' + esc(section[0]) + "</a>";
    }).join("");
    const body = sections.map(function (section) {
      return '<fieldset class="panel" id="' + slug(section[0]) + '" data-section="' + esc(section[0]) + '"><legend>' + esc(section[0]) + '</legend><div class="fields">' + section[1].join("") + "</div></fieldset>";
    }).join("");
    root.innerHTML = '<div class="page-intro"><p class="eyebrow">' + esc(programName) + " · Personal support services</p><h1>" + esc(visitName) + '</h1><p class="lede">Same clinical items as Tranquil’s paper assessment, grouped so you can move through the visit. Answers are encrypted in this browser before they leave it. Print a chart copy before you submit.</p></div>' +
      '<div class="form-shell"><nav class="section-nav" aria-label="Form sections">' + nav + "</nav>" +
      '<form class="secure-form" id="assessment-form" data-form="' + formId + '" data-title="' + esc(title) + '" data-staff="yes" data-blanks="yes" autocomplete="off">' +
      '<p class="print-only letterhead">Tranquil, Inc. · P.O. Box 2754, Kennesaw, GA 30156 · (678) 290-0070</p>' +
      '<p class="secure-note">Protected health information. Do not use a shared computer. A draft is kept only in this browser tab.</p>' +
      body +
      '<div class="form-actions"><button type="button" class="btn btn-ghost" data-print>Print for the chart</button><button type="submit" class="btn">Encrypt and submit</button></div>' +
      '<div class="form-status" role="status" aria-live="polite"></div></form></div>';
    TranquilForms.enhance(document.getElementById("assessment-form"));
  }

  document.addEventListener("DOMContentLoaded", function () {
    const params = new URLSearchParams(location.search);
    render(params.get("program"), params.get("visit"));
  });
})();
