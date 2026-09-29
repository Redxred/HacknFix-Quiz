-- Public sample bank: 20 MCQs, 8 written/CQ and 4 practical questions.
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
