-- Public sample bank: 40 MCQs, 16 written/CQ and 8 practical questions.
-- Safe to re-run. Existing questions and edits are preserved.
insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'A message asks you to share a one-time login code. What should you do?', '[{"text":"Keep the code private and verify the request through an official channel","correct":true},{"text":"Send the code if the sender knows your name","correct":false},{"text":"Post the code in the support group","correct":false},{"text":"Forward the code to a friend","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 101, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='A message asks you to share a one-time login code. What should you do?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'What is the main purpose of multi-factor authentication?', '[{"text":"Make every password shorter","correct":false},{"text":"Remove the need to update software","correct":false},{"text":"Encrypt every file on a device","correct":false},{"text":"Require evidence from more than one authentication factor","correct":true}]'::jsonb,
  1, '', 'Choose one answer.', 102, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='What is the main purpose of multi-factor authentication?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'Which practice best reduces the impact of a stolen password?', '[{"text":"Share passwords only with classmates","correct":false},{"text":"Store passwords in public notes","correct":false},{"text":"Use a different password for every account","correct":true},{"text":"Reuse one long password everywhere","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 103, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='Which practice best reduces the impact of a stolen password?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'What does the principle of least privilege mean?', '[{"text":"Use the shortest possible password","correct":false},{"text":"Give an account only the access it needs for its task","correct":true},{"text":"Give all users administrator access","correct":false},{"text":"Remove every user account","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 104, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='What does the principle of least privilege mean?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'Which control directly prevents SQL input from being interpreted as query syntax?', '[{"text":"Parameterized queries","correct":true},{"text":"Changing the page background","correct":false},{"text":"Hiding the login link","correct":false},{"text":"Renaming the database","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 105, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='Which control directly prevents SQL input from being interpreted as query syntax?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'What does HTTPS primarily protect while browsing?', '[{"text":"Every downloaded file from malware","correct":false},{"text":"The truth of all website content","correct":false},{"text":"The computer from every attack","correct":false},{"text":"Data in transit between the browser and the connected server","correct":true}]'::jsonb,
  1, '', 'Choose one answer.', 106, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='What does HTTPS primarily protect while browsing?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'Which backup is most resilient to ransomware on a connected workstation?', '[{"text":"A permanently writable network share using the same account","correct":false},{"text":"A screenshot of the file names","correct":false},{"text":"A tested backup isolated from the workstation and its credentials","correct":true},{"text":"A copy in another folder on the same disk","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 107, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='Which backup is most resilient to ransomware on a connected workstation?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'A phone app requests contacts access for a flashlight feature. What is the safest response?', '[{"text":"Send the app your account password","correct":false},{"text":"Deny unnecessary permission and reconsider using the app","correct":true},{"text":"Grant every requested permission","correct":false},{"text":"Disable the screen lock","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 108, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='A phone app requests contacts access for a flashlight feature. What is the safest response?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'Why should software security updates be installed?', '[{"text":"They can fix known vulnerabilities","correct":true},{"text":"They guarantee a device can never be compromised","correct":false},{"text":"They make backups unnecessary","correct":false},{"text":"They automatically replace every weak password","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 109, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='Why should software security updates be installed?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'Which is a useful first action after discovering an exposed API secret?', '[{"text":"Only rename the source file","correct":false},{"text":"Wait until the next release","correct":false},{"text":"Share the secret to ask whether it looks valid","correct":false},{"text":"Revoke or rotate the secret and investigate its use","correct":true}]'::jsonb,
  1, '', 'Choose one answer.', 110, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='Which is a useful first action after discovering an exposed API secret?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'What is hashing commonly used for in password storage?', '[{"text":"Compress all user data","correct":false},{"text":"Replace access control","correct":false},{"text":"Store a one-way password verifier using an appropriate password hashing algorithm","correct":true},{"text":"Recover the original password on demand","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 111, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='What is hashing commonly used for in password storage?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'What is a common sign of phishing?', '[{"text":"An email arriving during office hours","correct":false},{"text":"Pressure to act urgently through an unexpected link","correct":true},{"text":"A website using readable fonts","correct":false},{"text":"A message containing your first name","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 112, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='What is a common sign of phishing?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'What should happen to a session identifier after a successful login?', '[{"text":"It should be regenerated to reduce session fixation risk","correct":true},{"text":"It should be posted publicly","correct":false},{"text":"It should become the user password","correct":false},{"text":"It should always remain unchanged","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 113, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='What should happen to a session identifier after a successful login?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'What is the main purpose of security logging?', '[{"text":"Guarantee attacks cannot happen","correct":false},{"text":"Publish user passwords for recovery","correct":false},{"text":"Replace authentication","correct":false},{"text":"Provide evidence for detection and investigation","correct":true}]'::jsonb,
  1, '', 'Choose one answer.', 114, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='What is the main purpose of security logging?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'Which cookie attribute prevents JavaScript from reading a cookie?', '[{"text":"Path alone","correct":false},{"text":"Max-Age alone","correct":false},{"text":"HttpOnly","correct":true},{"text":"SameSite alone","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 115, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='Which cookie attribute prevents JavaScript from reading a cookie?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'What should you verify before conducting a security test?', '[{"text":"That the target has a public login page","correct":false},{"text":"Written authorization and the agreed scope","correct":true},{"text":"Only that the target is online","correct":false},{"text":"Only that a scanning tool is installed","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 116, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='What should you verify before conducting a security test?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'How should a server handle authorization for a protected record?', '[{"text":"Check the requester is allowed to access that specific record","correct":true},{"text":"Trust a hidden button in the browser","correct":false},{"text":"Trust any supplied record ID","correct":false},{"text":"Allow access whenever a user knows the URL","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 117, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='How should a server handle authorization for a protected record?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'Which measure helps reduce automated password guessing?', '[{"text":"Displaying whether each username exists","correct":false},{"text":"Using the same default password for every user","correct":false},{"text":"Disabling all login logs","correct":false},{"text":"Rate limiting combined with monitoring and strong authentication","correct":true}]'::jsonb,
  1, '', 'Choose one answer.', 118, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='Which measure helps reduce automated password guessing?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'What is the purpose of a recovery code for an MFA-protected account?', '[{"text":"Replace all future password changes","correct":false},{"text":"Make phishing messages safe","correct":false},{"text":"Provide a securely stored backup way to recover access","correct":true},{"text":"Allow anyone to skip login","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 119, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='What is the purpose of a recovery code for an MFA-protected account?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'How should sensitive data be handled in application logs?', '[{"text":"Put API keys in every error message","correct":false},{"text":"Exclude secrets and minimize or redact sensitive values","correct":true},{"text":"Log every password to simplify support","correct":false},{"text":"Publish the logs without review","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 120, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='How should sensitive data be handled in application logs?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'What is the primary purpose of a Content Security Policy?', '[{"text":"Restrict which content sources and script execution a browser is allowed to use","correct":true},{"text":"Replace server authorization checks","correct":false},{"text":"Guarantee every downloaded file is safe","correct":false},{"text":"Store user passwords in the browser","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 121, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='What is the primary purpose of a Content Security Policy?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'Which practice helps prevent untrusted text becoming executable HTML?', '[{"text":"Trust any text received from a logged-in user","correct":false},{"text":"Disable password changes","correct":false},{"text":"Hide the browser address bar","correct":false},{"text":"Use safe text insertion or context-appropriate output encoding","correct":true}]'::jsonb,
  1, '', 'Choose one answer.', 122, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='Which practice helps prevent untrusted text becoming executable HTML?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'What does a CSRF defense aim to prevent?', '[{"text":"A server making a backup","correct":false},{"text":"A browser displaying a public image","correct":false},{"text":"An attacker causing a browser to perform an unwanted authenticated action","correct":true},{"text":"A user reading their own saved document","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 123, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='What does a CSRF defense aim to prevent?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'Which cookie setting restricts sending the cookie to HTTPS connections?', '[{"text":"Expires alone","correct":false},{"text":"Secure","correct":true},{"text":"HttpOnly alone","correct":false},{"text":"Path alone","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 124, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='Which cookie setting restricts sending the cookie to HTTPS connections?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'What is the main distinction between encryption and hashing?', '[{"text":"Encryption is reversible with the appropriate key; password hashing is designed as a one-way verifier","correct":true},{"text":"Both always reveal the original data without a key","correct":false},{"text":"Hashing is only changing a filename","correct":false},{"text":"Encryption eliminates authorization requirements","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 125, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='What is the main distinction between encryption and hashing?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'Which action best protects an API secret used by a server?', '[{"text":"Embed it in public browser JavaScript","correct":false},{"text":"Paste it into a public issue","correct":false},{"text":"Add it to a shared screenshot","correct":false},{"text":"Keep it in a protected server-side configuration and restrict access","correct":true}]'::jsonb,
  1, '', 'Choose one answer.', 126, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='Which action best protects an API secret used by a server?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'Why should an application validate input on the server?', '[{"text":"Server checks replace all output encoding","correct":false},{"text":"Validation makes authentication unnecessary","correct":false},{"text":"Client-side checks can be bypassed and the server must enforce accepted values","correct":true},{"text":"Every browser always sends trusted input","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 127, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='Why should an application validate input on the server?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'What is a useful boundary for a database account used by an application?', '[{"text":"The ability to read all unrelated databases","correct":false},{"text":"Only the permissions needed for its operations","correct":true},{"text":"Unlimited administrative access by default","correct":false},{"text":"The ability to disable every security policy","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 128, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='What is a useful boundary for a database account used by an application?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'Which response most directly addresses an access-control failure found during an authorized test?', '[{"text":"Fix server-side permission checks and verify both permitted and denied access","correct":true},{"text":"Only remove the visible link","correct":false},{"text":"Only change the color of the page","correct":false},{"text":"Assume that obscure record IDs are sufficient","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 129, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='Which response most directly addresses an access-control failure found during an authorized test?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'What should a security incident response plan establish before an incident?', '[{"text":"A rule to delete all evidence immediately","correct":false},{"text":"Public copies of every secret","correct":false},{"text":"A promise that incidents will never happen","correct":false},{"text":"Responsibilities, reporting routes and containment and recovery procedures","correct":true}]'::jsonb,
  1, '', 'Choose one answer.', 130, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='What should a security incident response plan establish before an incident?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'Why can a logged-in user’s uploaded filename still be untrusted?', '[{"text":"Every extension verifies the actual file contents","correct":false},{"text":"A long filename automatically proves safety","correct":false},{"text":"Authentication does not guarantee the safety of supplied file names or content","correct":true},{"text":"Logged-in users cannot make mistakes","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 131, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='Why can a logged-in user’s uploaded filename still be untrusted?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'What is a safer way to handle user-provided file paths?', '[{"text":"Assume a hidden form field cannot be changed","correct":false},{"text":"Resolve paths within an allowed location and reject attempts to escape it","correct":true},{"text":"Concatenate any path directly to the server root","correct":false},{"text":"Allow parent-directory traversal for every user","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 132, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='What is a safer way to handle user-provided file paths?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'Why should an inactive staff account be disabled promptly?', '[{"text":"It reduces unnecessary access and the risk of later misuse","correct":true},{"text":"It automatically patches the operating system","correct":false},{"text":"It replaces all audit logs","correct":false},{"text":"It increases the strength of other passwords","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 133, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='Why should an inactive staff account be disabled promptly?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'What is the purpose of network segmentation?', '[{"text":"Make every service publicly reachable","correct":false},{"text":"Share one administrator password everywhere","correct":false},{"text":"Remove the need to monitor traffic","correct":false},{"text":"Limit communication between systems according to their needs and trust boundaries","correct":true}]'::jsonb,
  1, '', 'Choose one answer.', 134, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='What is the purpose of network segmentation?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'A dependency has a reported security weakness. What is a useful response?', '[{"text":"Remove all application backups","correct":false},{"text":"Publish the production credentials for review","correct":false},{"text":"Assess exposure, apply a verified fix or mitigation and test the application","correct":true},{"text":"Ignore it because dependencies are never part of an application","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 135, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='A dependency has a reported security weakness. What is a useful response?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'Which practice improves the reliability of security alerts?', '[{"text":"Assume every notification confirms a breach","correct":false},{"text":"Review and tune alerts using evidence and investigate relevant events","correct":true},{"text":"Disable every alert after the first false positive","correct":false},{"text":"Publish all alerts with customer secrets","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 136, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='Which practice improves the reliability of security alerts?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'Why separate production and test credentials?', '[{"text":"A problem in a test environment should not automatically grant production access","correct":true},{"text":"It guarantees the test environment has no bugs","correct":false},{"text":"It removes the need to rotate exposed secrets","correct":false},{"text":"It makes every account an administrator","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 137, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='Why separate production and test credentials?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'What should an application do when a user signs out?', '[{"text":"Keep every session valid indefinitely","correct":false},{"text":"Publish the session token","correct":false},{"text":"Replace the user password with the session ID","correct":false},{"text":"Invalidate the relevant session and clear its client credential as appropriate","correct":true}]'::jsonb,
  1, '', 'Choose one answer.', 138, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='What should an application do when a user signs out?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'How should account recovery be designed?', '[{"text":"Send the current password in plain text","correct":false},{"text":"Remove all verification when a request sounds urgent","correct":false},{"text":"Verify identity through a defined process without exposing or bypassing account protections","correct":true},{"text":"Let anyone reset an account by knowing its name","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 139, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='How should account recovery be designed?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'mcq', 'Why test restores as well as creating backups?', '[{"text":"It removes the need for access control","correct":false},{"text":"A backup is useful only if required data can actually be recovered","correct":true},{"text":"A restore test makes future backups unnecessary","correct":false},{"text":"It guarantees there will be no data loss in any incident","correct":false}]'::jsonb,
  1, '', 'Choose one answer.', 140, true
where not exists (select 1 from public.exam_questions where qtype='mcq' and prompt='Why test restores as well as creating backups?');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'written', 'An employee enters their password on a fake sign-in page and reports it ten minutes later. Describe your response in order, including account recovery and how you would check for misuse.', '[]'::jsonb,
  10, 'Cover reporting and containment, resetting the affected credential from a trusted device, revoking sessions, reviewing account activity and MFA settings, checking reused passwords, and documenting the incident.', 'Explain your reasoning. Around 150–250 words is enough.', 101, true
where not exists (select 1 from public.exam_questions where qtype='written' and prompt='An employee enters their password on a fake sign-in page and reports it ten minutes later. Describe your response in order, including account recovery and how you would check for misuse.');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'written', 'A college stores student names, phone numbers and exam results in one application. Propose an access-control model for students, teachers and administrators. Explain how the server should enforce it.', '[]'::jsonb,
  10, 'Students access their own records; teachers access assigned classes and marking tasks; administrators receive scoped management access. Enforce ownership and roles on the server, audit changes, and review permissions.', 'Explain your reasoning. Around 150–250 words is enough.', 102, true
where not exists (select 1 from public.exam_questions where qtype='written' and prompt='A college stores student names, phone numbers and exam results in one application. Propose an access-control model for students, teachers and administrators. Explain how the server should enforce it.');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'written', 'Compare authentication and authorization using an online exam portal as your example. Give one failure scenario for each and a practical prevention measure.', '[]'::jsonb,
  10, 'Authentication establishes identity; authorization determines permitted actions. Examples include stolen credentials and reading another student paper by changing its ID. Discuss MFA/session protection and record-level authorization.', 'Explain your reasoning. Around 150–250 words is enough.', 103, true
where not exists (select 1 from public.exam_questions where qtype='written' and prompt='Compare authentication and authorization using an online exam portal as your example. Give one failure scenario for each and a practical prevention measure.');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'written', 'A business has daily backups but has never restored them. Design a backup and recovery test, including how success will be measured.', '[]'::jsonb,
  10, 'Define recovery objectives, identify critical data, maintain protected isolated copies, restore into a safe environment, check integrity and application functionality, measure time and data loss, and document improvements.', 'Explain your reasoning. Around 150–250 words is enough.', 104, true
where not exists (select 1 from public.exam_questions where qtype='written' and prompt='A business has daily backups but has never restored them. Design a backup and recovery test, including how success will be measured.');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'written', 'Explain why HTTPS does not prove that a website is trustworthy. Describe three checks a user can make before entering sensitive information.', '[]'::jsonb,
  10, 'HTTPS protects the connection to the connected endpoint; a malicious site can use it too. Verify the expected domain, navigate independently through a trusted source, inspect the request and avoid unexpected payment or credential demands.', 'Explain your reasoning. Around 150–250 words is enough.', 105, true
where not exists (select 1 from public.exam_questions where qtype='written' and prompt='Explain why HTTPS does not prove that a website is trustworthy. Describe three checks a user can make before entering sensitive information.');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'written', 'A developer wants to log complete login requests to debug a problem. Explain the risks and propose a useful logging format that avoids exposing secrets.', '[]'::jsonb,
  10, 'Exclude passwords, authorization headers, session tokens and recovery codes. Record event type, timestamp, pseudonymous account reference, outcome and correlation ID. Restrict access and retention.', 'Explain your reasoning. Around 150–250 words is enough.', 106, true
where not exists (select 1 from public.exam_questions where qtype='written' and prompt='A developer wants to log complete login requests to debug a problem. Explain the risks and propose a useful logging format that avoids exposing secrets.');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'written', 'Design a short security-awareness session for students who use mobile banking. Include three realistic scam scenarios and a safe response for each.', '[]'::jsonb,
  10, 'Use scenarios such as OTP requests, fake customer support and misleading payment links. Encourage independent verification, never sharing PINs/OTPs, verifying recipients and using official reporting channels.', 'Explain your reasoning. Around 150–250 words is enough.', 107, true
where not exists (select 1 from public.exam_questions where qtype='written' and prompt='Design a short security-awareness session for students who use mobile banking. Include three realistic scam scenarios and a safe response for each.');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'written', 'A team member has left an organization. Write an offboarding checklist and explain why disabling their main email account alone is insufficient.', '[]'::jsonb,
  10, 'Remove access across identity providers, applications, cloud resources and shared accounts; revoke sessions and tokens, recover devices, transfer ownership safely, rotate shared secrets and audit completion.', 'Explain your reasoning. Around 150–250 words is enough.', 108, true
where not exists (select 1 from public.exam_questions where qtype='written' and prompt='A team member has left an organization. Write an offboarding checklist and explain why disabling their main email account alone is insufficient.');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'written', 'An exam portal allows a student to change an attempt ID in a request and read another student’s paper. Explain the weakness and propose a fix and a regression test.', '[]'::jsonb,
  10, 'Identify broken record-level authorization. Derive identity from a verified session or attempt token, check access to the requested record on the server, deny mismatched access without disclosure, and test two accounts with positive and negative cases.', 'Explain your reasoning. Around 150–250 words is enough.', 109, true
where not exists (select 1 from public.exam_questions where qtype='written' and prompt='An exam portal allows a student to change an attempt ID in a request and read another student’s paper. Explain the weakness and propose a fix and a regression test.');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'written', 'Compare protection provided by a firewall, software updates and secure backups. Explain why an organization needs more than one of these controls.', '[]'::jsonb,
  10, 'A firewall controls allowed traffic, updates address known flaws, and protected backups support recovery. Discuss limits of each, layered defenses, least privilege and testing rather than claiming any control prevents every attack.', 'Explain your reasoning. Around 150–250 words is enough.', 110, true
where not exists (select 1 from public.exam_questions where qtype='written' and prompt='Compare protection provided by a firewall, software updates and secure backups. Explain why an organization needs more than one of these controls.');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'written', 'An API key was accidentally committed to a public repository. Describe the immediate response and steps to prevent recurrence.', '[]'::jsonb,
  10, 'Revoke or rotate the key first, assess permissions and usage, review logs, update the application safely, remove exposed material where practical, and use protected configuration and secret scanning. Deleting a commit alone does not invalidate an exposed key.', 'Explain your reasoning. Around 150–250 words is enough.', 111, true
where not exists (select 1 from public.exam_questions where qtype='written' and prompt='An API key was accidentally committed to a public repository. Describe the immediate response and steps to prevent recurrence.');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'written', 'Explain how you would design secure password reset for a student portal without sending the old password to the student.', '[]'::jsonb,
  10, 'Use a defined identity verification process, a short-lived single-use random reset token, protected delivery, rate limits, generic responses where appropriate, a new password verifier and session review. Never recover or email the old password.', 'Explain your reasoning. Around 150–250 words is enough.', 112, true
where not exists (select 1 from public.exam_questions where qtype='written' and prompt='Explain how you would design secure password reset for a student portal without sending the old password to the student.');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'written', 'A class receives a shared link to a folder containing student contact details. Propose a safer sharing process and how you would review existing exposure.', '[]'::jsonb,
  10, 'Limit fields and recipients to the actual purpose, use scoped access rather than public links, set a review or expiry process, revoke inappropriate sharing, examine access records where available and handle notification through the institution’s process.', 'Explain your reasoning. Around 150–250 words is enough.', 113, true
where not exists (select 1 from public.exam_questions where qtype='written' and prompt='A class receives a shared link to a folder containing student contact details. Propose a safer sharing process and how you would review existing exposure.');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'written', 'A student says an account was compromised despite having MFA enabled. Explain possible causes and what evidence you would examine.', '[]'::jsonb,
  10, 'Consider phishing, unsolicited approval, stolen sessions, weak recovery paths and compromised devices without assuming the cause. Review login and session activity, MFA enrollment changes, recovery events and reported timelines; contain access and preserve evidence.', 'Explain your reasoning. Around 150–250 words is enough.', 114, true
where not exists (select 1 from public.exam_questions where qtype='written' and prompt='A student says an account was compromised despite having MFA enabled. Explain possible causes and what evidence you would examine.');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'written', 'Design a simple process for prioritizing security issues in a small organization. Include how you would verify that a fix worked.', '[]'::jsonb,
  10, 'Assess exploitability, exposure, affected data and business impact; assign owners and deadlines; test changes in an appropriate environment, verify the original failure and permitted behavior, and document remaining risk. Do not rank solely by the number of alerts.', 'Explain your reasoning. Around 150–250 words is enough.', 115, true
where not exists (select 1 from public.exam_questions where qtype='written' and prompt='Design a simple process for prioritizing security issues in a small organization. Include how you would verify that a fix worked.');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'written', 'Explain the risks of collecting more personal information than an exam portal needs. Propose data minimization, access and retention practices.', '[]'::jsonb,
  10, 'Collect only fields justified by the exam process, separate public results from contact details, restrict access, protect exports, define retention and deletion procedures, and review logging and backups. Explain purpose without inventing a universal legal retention period.', 'Explain your reasoning. Around 150–250 words is enough.', 116, true
where not exists (select 1 from public.exam_questions where qtype='written' and prompt='Explain the risks of collecting more personal information than an exam portal needs. Propose data minimization, access and retention practices.');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'practical', 'Write pseudocode for a login endpoint that uses a parameterized database query, a password verifier and safe session creation. Include how errors and repeated failures are handled.', '[]'::jsonb,
  15, 'Use a parameterized lookup, appropriate password hash verification, generic errors, rate limiting, session rotation and secure cookie settings. Never log passwords.', 'Use numbered steps or clear pseudocode.', 101, true
where not exists (select 1 from public.exam_questions where qtype='practical' and prompt='Write pseudocode for a login endpoint that uses a parameterized database query, a password verifier and safe session creation. Include how errors and repeated failures are handled.');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'practical', 'You are reviewing your own exam application. Write a manual test plan to verify that one student cannot read or change another student’s answers. Use two test accounts and describe expected outcomes.', '[]'::jsonb,
  15, 'Create separate accounts and attempts; test record ID substitution, missing/incorrect tokens and unauthenticated requests in an authorized test environment. Require denial with no disclosure or modification. Include positive controls and record evidence.', 'Use numbered steps or clear pseudocode.', 102, true
where not exists (select 1 from public.exam_questions where qtype='practical' and prompt='You are reviewing your own exam application. Write a manual test plan to verify that one student cannot read or change another student’s answers. Use two test accounts and describe expected outcomes.');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'practical', 'For an isolated training server you administer, outline a safe procedure to deploy a security update. Include preparation, verification and rollback steps.', '[]'::jsonb,
  15, 'Inventory and check compatibility, back up and test recovery, validate in staging, plan a maintenance window, apply trusted updates, verify services/logs and document a tested rollback.', 'Use numbered steps or clear pseudocode.', 103, true
where not exists (select 1 from public.exam_questions where qtype='practical' and prompt='For an isolated training server you administer, outline a safe procedure to deploy a security update. Include preparation, verification and rollback steps.');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'practical', 'Write a checklist to investigate a suspicious email using a saved sample without following its links or opening its attachments. State what evidence you would preserve.', '[]'::jsonb,
  15, 'Preserve the message and headers, inspect sender/reply-to and domains as text, review authentication results in context, identify requests and pressure tactics, report through the official channel and preserve evidence without executing content.', 'Use numbered steps or clear pseudocode.', 104, true
where not exists (select 1 from public.exam_questions where qtype='practical' and prompt='Write a checklist to investigate a suspicious email using a saved sample without following its links or opening its attachments. State what evidence you would preserve.');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'practical', 'Write pseudocode for an exam answer-save endpoint. Show how you verify the attempt token, question ownership, allowed answer format, attempt status and deadline before updating a row.', '[]'::jsonb,
  15, 'Validate the token against the requested attempt, require the question to belong to that paper, enforce in-progress status and the server deadline, validate MCQ indexes or text limits, and write only permitted answer fields atomically. Reject wrong tokens and cross-paper questions; never accept student-supplied marks.', 'Use numbered steps or clear pseudocode.', 105, true
where not exists (select 1 from public.exam_questions where qtype='practical' and prompt='Write pseudocode for an exam answer-save endpoint. Show how you verify the attempt token, question ownership, allowed answer format, attempt status and deadline before updating a row.');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'practical', 'Create a recovery test plan for a local training application. Simulate a lost start response and a lost submission response, and describe how you would prove retries do not duplicate records.', '[]'::jsonb,
  15, 'Use a disposable environment, keep a start recovery token before the request, simulate a committed response being lost, retry with the same identity and token, and verify one paper. Retry submission and compare status and score without duplicate writes. Include failed-save and restored-network cases.', 'Use numbered steps or clear pseudocode.', 106, true
where not exists (select 1 from public.exam_questions where qtype='practical' and prompt='Create a recovery test plan for a local training application. Simulate a lost start response and a lost submission response, and describe how you would prove retries do not duplicate records.');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'practical', 'Prepare a secure deployment checklist for a small web application with a public frontend and a private database. Explain how you would verify each item.', '[]'::jsonb,
  15, 'Keep privileged secrets on the server, use HTTPS, enforce table and record permissions, restrict admin access, check public data exposure, set useful logs without secrets, maintain updates and tested backups, and test both permitted operations and forbidden reads or writes.', 'Use numbered steps or clear pseudocode.', 107, true
where not exists (select 1 from public.exam_questions where qtype='practical' and prompt='Prepare a secure deployment checklist for a small web application with a public frontend and a private database. Explain how you would verify each item.');

insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select 'practical', 'Using two authorized test accounts, write a manual verification procedure for sign-out, session expiry and password reset. Specify what should happen to protected requests in each case.', '[]'::jsonb,
  15, 'Test valid access first, sign out and retry protected operations, exercise configured expiry, complete reset through the defined process and check session invalidation according to policy. Record identities and outcomes without exposing tokens; confirm failed requests disclose no protected data.', 'Use numbered steps or clear pseudocode.', 108, true
where not exists (select 1 from public.exam_questions where qtype='practical' and prompt='Using two authorized test accounts, write a manual verification procedure for sign-out, session expiry and password reset. Specify what should happen to protected requests in each case.');
