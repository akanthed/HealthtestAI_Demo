 -- ==========================
-- Core Healthcare, Quality & Security Standards
-- ==========================

-- HIPAA
INSERT INTO `skillful-jetty-467110-v3.healthtest_ai_dataset.compliance_standards`
(standard_id, standard_name, standard_version, jurisdiction, category, source_url,
 raw_text, requirement_id, requirement_text, evidence_needed, testing_guidance, keywords)
VALUES
('HIPAA_SECURITY', 'HIPAA Security Rule', '2013 Final Rule', 'US', 'Healthcare Privacy & Security',
 'https://www.hhs.gov/hipaa/for-professionals/security/index.html',
 'Technical safeguards for electronic PHI',
 '164.312(a)(1)', 'Implement access control and authentication safeguards for ePHI.',
 ['Access control logs','Audit trails','User authentication policies'],
 'Verify access control enforcement and authentication logs are generated and retained.',
 ['hipaa','access control','authentication','ephi']);

-- GDPR
INSERT INTO `skillful-jetty-467110-v3.healthtest_ai_dataset.compliance_standards`
(standard_id, standard_name, standard_version, jurisdiction, category, source_url,
 raw_text, requirement_id, requirement_text, evidence_needed, testing_guidance, keywords)
VALUES
('GDPR_ART32', 'General Data Protection Regulation', '2016', 'EU', 'Data Protection',
 'https://eur-lex.europa.eu/eli/reg/2016/679/oj',
 'Article 32: Security of processing',
 'Article 32', 'Implement encryption, pseudonymisation, resilience, and regular testing.',
 ['Encryption certs','Pseudonymisation policies','Pen test reports'],
 'Verify encryption at-rest/in-transit and resilience tests.',
 ['gdpr','encryption','pseudonymisation','personal data']);

-- FDA 21 CFR Part 820
INSERT INTO `skillful-jetty-467110-v3.healthtest_ai_dataset.compliance_standards`
(standard_id, standard_name, standard_version, jurisdiction, category, source_url,
 raw_text, requirement_id, requirement_text, evidence_needed, testing_guidance, keywords)
VALUES
('FDA_21CFR820', 'FDA 21 CFR Part 820 - Quality System Regulation', '2022', 'US', 'Medical Device Quality',
 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-820',
 'Design controls and process validation requirements',
 '820.30(a)', 'Establish and maintain design controls.', 
 ['Design history file','Design review records'],
 'Check DHF completeness and design review sign-offs.',
 ['fda','design control','medical device']);

-- IEC 62304 (traceability)
INSERT INTO `skillful-jetty-467110-v3.healthtest_ai_dataset.compliance_standards`
(standard_id, standard_name, standard_version, jurisdiction, category, source_url,
 raw_text, requirement_id, requirement_text, evidence_needed, testing_guidance, keywords)
VALUES
('IEC_62304', 'IEC 62304 Medical Device Software', '2006+Amd1:2015', 'Global', 'Medical Device Software Lifecycle',
 'https://www.iso.org/standard/38421.html',
 'Software life cycle requirements (planning, architecture, testing, maintenance)',
 '5.1', 'Software development planning shall include traceability and verification deliverables.',
 ['Development plan','Traceability matrix','Verification reports'],
 'Check test cases trace to system/software requirements.',
 ['iec62304','traceability','software lifecycle']);

-- IEC 62304 (unit verification)
INSERT INTO `skillful-jetty-467110-v3.healthtest_ai_dataset.compliance_standards`
(standard_id, standard_name, standard_version, jurisdiction, category, source_url,
 raw_text, requirement_id, requirement_text, evidence_needed, testing_guidance, keywords)
VALUES
('IEC_62304', 'IEC 62304 Medical Device Software', '2006+Amd1:2015', 'Global', 'Medical Device Software Lifecycle',
 'https://www.iso.org/standard/38421.html',
 'Unit implementation and verification requirements',
 '5.5.1', 'Each software unit shall be verified (unit test, static/dynamic analysis).',
 ['Unit test reports','Static analysis logs','Code coverage metrics'],
 'Check unit test coverage and static analysis compliance.',
 ['iec62304','unit test','verification']);

-- ISO 9001
INSERT INTO `skillful-jetty-467110-v3.healthtest_ai_dataset.compliance_standards`
(standard_id, standard_name, standard_version, jurisdiction, category, source_url,
 raw_text, requirement_id, requirement_text, evidence_needed, testing_guidance, keywords)
VALUES
('ISO_9001', 'ISO 9001 Quality Management Systems', '2015', 'Global', 'Quality Management',
 'https://www.iso.org/iso-9001-quality-management.html',
 'Clause 8: Operation – planning, control, and monitoring',
 '8.2', 'Plan and control product/service provision to meet requirements.',
 ['QMS policies','Internal audit reports'],
 'Verify QMS processes are documented and followed.',
 ['iso9001','quality','qms']);

-- ISO 13485
INSERT INTO `skillful-jetty-467110-v3.healthtest_ai_dataset.compliance_standards`
(standard_id, standard_name, standard_version, jurisdiction, category, source_url,
 raw_text, requirement_id, requirement_text, evidence_needed, testing_guidance, keywords)
VALUES
('ISO_13485', 'ISO 13485 Medical Devices Quality Management', '2016', 'Global', 'Medical Device Quality',
 'https://www.iso.org/standard/59752.html',
 'Clause 7: Product realization – risk management and design controls',
 '7.3.2', 'Implement design and development planning for medical devices.',
 ['Risk management file','Design plan'],
 'Verify design inputs, risk controls, and outputs are documented.',
 ['iso13485','medical device','quality']);

-- ISO 27001
INSERT INTO `skillful-jetty-467110-v3.healthtest_ai_dataset.compliance_standards`
(standard_id, standard_name, standard_version, jurisdiction, category, source_url,
 raw_text, requirement_id, requirement_text, evidence_needed, testing_guidance, keywords)
VALUES
('ISO_27001', 'ISO 27001 Information Security Management', '2022', 'Global', 'Information Security',
 'https://www.iso.org/isoiec-27001-information-security.html',
 'Annex A controls for access management, logging, and encryption',
 'A.9.2', 'User access provisioning shall be formally managed.',
 ['Access request records','User account reviews'],
 'Verify user access provisioning and review process.',
 ['iso27001','information security','access control']);


-- ==========================
-- Core Healthcare & Quality Standards (FIXED)
-- ==========================

-- HIPAA Security Rule (US) - Main Requirements
INSERT INTO `skillful-jetty-467110-v3.healthtest_ai_dataset.compliance_standards`
(standard_id, standard_name, standard_version, jurisdiction, category, source_url, raw_text,
 requirement_id, requirement_text, evidence_needed, testing_guidance, keywords, last_updated)
VALUES
('HIPAA_SECURITY', 'HIPAA Security Rule', '2013 Final Rule', 'US', 'Healthcare Privacy & Security',
 'https://www.hhs.gov/hipaa/for-professionals/security/index.html',
 'Technical safeguards for electronic PHI',
 '164.312(a)(1)', 'Implement access control and authentication safeguards for ePHI.',
 ['Access control logs','Audit trails','User authentication policies'],
 'Verify access control enforcement and authentication logs are generated and retained.',
 ['hipaa','access control','authentication','ephi'], CURRENT_TIMESTAMP()),

('HIPAA_SECURITY', 'HIPAA Security Rule', '2013 Final Rule', 'US', 'Healthcare Privacy & Security',
 'https://www.hhs.gov/hipaa/for-professionals/security/index.html',
 'Unique user identification',
 '164.312(a)(2)(i)', 'Assign a unique name and/or number for identifying and tracking user identity.',
 ['User ID assignment logs','User identity tracking records','Access audit logs'],
 'Verify unique user identification and tracking mechanisms are implemented.',
 ['hipaa','user identification','tracking','ephi'], CURRENT_TIMESTAMP()),

('HIPAA_SECURITY', 'HIPAA Security Rule', '2013 Final Rule', 'US', 'Healthcare Privacy & Security',
 'https://www.hhs.gov/hipaa/for-professionals/security/index.html',
 'Automatic logoff safeguards',
 '164.312(a)(2)(iii)', 'Implement automatic logoff after predetermined time of inactivity.',
 ['Session timeout configuration','Auto-logoff test results','Session management policies'],
 'Test automatic session termination after specified inactivity periods.',
 ['hipaa','session timeout','automatic logoff','security'], CURRENT_TIMESTAMP()),

('HIPAA_SECURITY', 'HIPAA Security Rule', '2013 Final Rule', 'US', 'Healthcare Privacy & Security',
 'https://www.hhs.gov/hipaa/for-professionals/security/index.html',
 'Audit controls and monitoring',
 '164.312(b)', 'Implement hardware, software, and/or procedural mechanisms that record access to ePHI.',
 ['Audit log configurations','Access monitoring reports','Security incident logs'],
 'Verify comprehensive audit logging of all ePHI access and modifications.',
 ['hipaa','audit controls','monitoring','access logs'], CURRENT_TIMESTAMP()),

('HIPAA_SECURITY', 'HIPAA Security Rule', '2013 Final Rule', 'US', 'Healthcare Privacy & Security',
 'https://www.hhs.gov/hipaa/for-professionals/security/index.html',
 'Integrity controls for ePHI',
 '164.312(c)(1)', 'Implement ePHI integrity controls to prevent improper alteration or destruction.',
 ['Data integrity verification','Checksum validation','Version control logs'],
 'Test data integrity mechanisms and unauthorized modification detection.',
 ['hipaa','data integrity','alteration protection','ephi'], CURRENT_TIMESTAMP()),

('HIPAA_SECURITY', 'HIPAA Security Rule', '2013 Final Rule', 'US', 'Healthcare Privacy & Security',
 'https://www.hhs.gov/hipaa/for-professionals/security/index.html',
 'Person or entity authentication',
 '164.312(d)', 'Verify that a person or entity seeking access is the one claimed.',
 ['Multi-factor authentication setup','Identity verification procedures','Authentication logs'],
 'Test multi-factor authentication and identity verification processes.',
 ['hipaa','authentication','identity verification','mfa'], CURRENT_TIMESTAMP()),

('HIPAA_SECURITY', 'HIPAA Security Rule', '2013 Final Rule', 'US', 'Healthcare Privacy & Security',
 'https://www.hhs.gov/hipaa/for-professionals/security/index.html',
 'Transmission security for ePHI',
 '164.312(e)(1)', 'Guard against unauthorized access to ePHI transmitted over networks.',
 ['Encryption certificates','Network security configurations','Transmission logs'],
 'Verify encryption of ePHI during network transmission and secure protocols.',
 ['hipaa','transmission security','network encryption','ephi'], CURRENT_TIMESTAMP());

-- GDPR (EU) - Enhanced Requirements
INSERT INTO `skillful-jetty-467110-v3.healthtest_ai_dataset.compliance_standards`
(standard_id, standard_name, standard_version, jurisdiction, category, source_url, raw_text,
 requirement_id, requirement_text, evidence_needed, testing_guidance, keywords, last_updated)
VALUES
('GDPR_ART32', 'General Data Protection Regulation', '2016', 'EU', 'Data Protection',
 'https://eur-lex.europa.eu/eli/reg/2016/679/oj',
 'Article 32: Security of processing',
 'Article 32', 'Implement encryption, pseudonymisation, resilience, and regular testing.',
 ['Encryption certs','Pseudonymisation policies','Pen test reports'],
 'Verify encryption at-rest/in-transit and resilience tests.',
 ['gdpr','encryption','pseudonymisation','personal data'], CURRENT_TIMESTAMP()),

('GDPR_ART25', 'General Data Protection Regulation', '2016', 'EU', 'Data Protection',
 'https://eur-lex.europa.eu/eli/reg/2016/679/oj',
 'Article 25: Data protection by design and by default',
 'Article 25(1)', 'Implement data protection by design with appropriate technical and organisational measures.',
 ['Privacy impact assessments','Data protection design documentation','Technical safeguards'],
 'Verify data protection principles are built into system design from the outset.',
 ['gdpr','privacy by design','data protection','technical measures'], CURRENT_TIMESTAMP()),

('GDPR_ART17', 'General Data Protection Regulation', '2016', 'EU', 'Data Protection',
 'https://eur-lex.europa.eu/eli/reg/2016/679/oj',
 'Article 17: Right to erasure (right to be forgotten)',
 'Article 17(1)', 'The data subject shall have the right to obtain erasure of personal data.',
 ['Data deletion procedures','Erasure verification logs','Data retention policies'],
 'Test data subject erasure requests and verify complete data removal.',
 ['gdpr','right to erasure','data deletion','personal data'], CURRENT_TIMESTAMP()),

('GDPR_ART33', 'General Data Protection Regulation', '2016', 'EU', 'Data Protection',
 'https://eur-lex.europa.eu/eli/reg/2016/679/oj',
 'Article 33: Notification of personal data breach to supervisory authority',
 'Article 33(1)', 'Notify supervisory authority of personal data breach within 72 hours.',
 ['Breach detection procedures','Incident response logs','Notification templates'],
 'Test breach detection and notification procedures within required timeframes.',
 ['gdpr','data breach','notification','incident response'], CURRENT_TIMESTAMP());

-- FDA 21 CFR Part 820 (US) - Enhanced Requirements
INSERT INTO `skillful-jetty-467110-v3.healthtest_ai_dataset.compliance_standards`
(standard_id, standard_name, standard_version, jurisdiction, category, source_url, raw_text,
 requirement_id, requirement_text, evidence_needed, testing_guidance, keywords, last_updated)
VALUES
('FDA_21CFR820', 'FDA 21 CFR Part 820 - Quality System Regulation', '2022', 'US', 'Medical Device Quality',
 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-820',
 'Design controls and process validation requirements',
 '820.30(a)', 'Establish and maintain design controls.', 
 ['Design history file','Design review records'],
 'Check DHF completeness and design review sign-offs.',
 ['fda','design control','medical device'], CURRENT_TIMESTAMP()),

('FDA_21CFR820', 'FDA 21 CFR Part 820 - Quality System Regulation', '2022', 'US', 'Medical Device Quality',
 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-820',
 'Design validation requirements',
 '820.30(g)', 'Design validation shall ensure device conforms to defined user needs.',
 ['Validation protocols','Clinical evaluation data','User needs specifications'],
 'Verify design validation demonstrates device meets user needs and intended use.',
 ['fda','design validation','user needs','clinical evaluation'], CURRENT_TIMESTAMP()),

('FDA_21CFR820', 'FDA 21 CFR Part 820 - Quality System Regulation', '2022', 'US', 'Medical Device Quality',
 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-820',
 'Design transfer requirements',
 '820.30(h)', 'Design transfer shall ensure device design is correctly translated into production.',
 ['Production specifications','Manufacturing procedures','Transfer verification'],
 'Verify design transfer maintains design integrity in production specifications.',
 ['fda','design transfer','production','manufacturing'], CURRENT_TIMESTAMP()),

('FDA_21CFR820', 'FDA 21 CFR Part 820 - Quality System Regulation', '2022', 'US', 'Medical Device Quality',
 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-820',
 'Design changes control',
 '820.30(i)', 'Design changes shall be validated or verified as appropriate.',
 ['Change control procedures','Impact assessments','Validation of changes'],
 'Test change control process and verify validation of design modifications.',
 ['fda','design changes','change control','validation'], CURRENT_TIMESTAMP()),

('FDA_21CFR820', 'FDA 21 CFR Part 820 - Quality System Regulation', '2022', 'US', 'Medical Device Quality',
 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-820',
 'Process validation requirements',
 '820.75(a)', 'Where process results cannot be fully verified, validation shall be performed.',
 ['Process validation protocols','Statistical process control','Validation reports'],
 'Verify process validation for critical manufacturing processes.',
 ['fda','process validation','statistical control','manufacturing'], CURRENT_TIMESTAMP());

-- IEC 62304 (Medical Device Software Lifecycle) - Enhanced
INSERT INTO `skillful-jetty-467110-v3.healthtest_ai_dataset.compliance_standards`
(standard_id, standard_name, standard_version, jurisdiction, category, source_url, raw_text,
 requirement_id, requirement_text, evidence_needed, testing_guidance, keywords, last_updated)
VALUES
('IEC_62304', 'IEC 62304 Medical Device Software', '2006+Amd1:2015', 'Global', 'Medical Device Software Lifecycle',
 'https://www.iso.org/standard/38421.html',
 'Software development planning shall include traceability and verification deliverables',
 '5.1', 'Software development planning shall include traceability and verification deliverables.',
 ['Development plan','Traceability matrix','Verification reports'],
 'Check test cases trace to system/software requirements.',
 ['iec62304','traceability','software lifecycle'], CURRENT_TIMESTAMP()),

('IEC_62304', 'IEC 62304 Medical Device Software', '2006+Amd1:2015', 'Global', 'Medical Device Software Lifecycle',
 'https://www.iso.org/standard/38421.html',
 'Software safety classification requirements',
 '4.3', 'Classify software based on potential harm: Class A, B, or C.',
 ['Safety classification rationale','Hazard analysis','Risk assessment'],
 'Verify appropriate software safety classification and supporting analysis.',
 ['iec62304','safety classification','risk analysis','hazard'], CURRENT_TIMESTAMP()),

('IEC_62304', 'IEC 62304 Medical Device Software', '2006+Amd1:2015', 'Global', 'Medical Device Software Lifecycle',
 'https://www.iso.org/standard/38421.html',
 'Software architectural design requirements',
 '5.3.1', 'Transform software requirements into software architecture.',
 ['Architecture documentation','Interface specifications','Design rationale'],
 'Verify software architecture addresses all requirements and interfaces.',
 ['iec62304','software architecture','design','interfaces'], CURRENT_TIMESTAMP()),

('IEC_62304', 'IEC 62304 Medical Device Software', '2006+Amd1:2015', 'Global', 'Medical Device Software Lifecycle',
 'https://www.iso.org/standard/38421.html',
 'Unit implementation and verification requirements',
 '5.5.1', 'Each software unit shall be verified (unit test, static/dynamic analysis).',
 ['Unit test reports','Static analysis logs','Code coverage metrics'],
 'Check unit test coverage and static analysis compliance.',
 ['iec62304','unit test','verification'], CURRENT_TIMESTAMP()),

('IEC_62304', 'IEC 62304 Medical Device Software', '2006+Amd1:2015', 'Global', 'Medical Device Software Lifecycle',
 'https://www.iso.org/standard/38421.html',
 'Software integration and integration testing',
 '5.6.1', 'Integrate software units and conduct integration testing.',
 ['Integration test plans','Integration test results','Interface testing'],
 'Verify software integration testing validates interfaces between units.',
 ['iec62304','integration testing','interfaces','software units'], CURRENT_TIMESTAMP()),

('IEC_62304', 'IEC 62304 Medical Device Software', '2006+Amd1:2015', 'Global', 'Medical Device Software Lifecycle',
 'https://www.iso.org/standard/38421.html',
 'Software system testing requirements',
 '5.7.1', 'Conduct system testing to verify requirements implementation.',
 ['System test plans','Test execution records','Requirements traceability'],
 'Verify system testing validates all software requirements implementation.',
 ['iec62304','system testing','requirements verification','traceability'], CURRENT_TIMESTAMP());

-- ISO 9001 (Quality Management Systems) - Enhanced
INSERT INTO `skillful-jetty-467110-v3.healthtest_ai_dataset.compliance_standards`
(standard_id, standard_name, standard_version, jurisdiction, category, source_url, raw_text,
 requirement_id, requirement_text, evidence_needed, testing_guidance, keywords, last_updated)
VALUES
('ISO_9001', 'ISO 9001 Quality Management Systems', '2015', 'Global', 'Quality Management',
 'https://www.iso.org/iso-9001-quality-management.html',
 'Clause 8: Operation – planning, control, and monitoring',
 '8.2', 'Plan and control product/service provision to meet requirements.',
 ['QMS policies','Internal audit reports'],
 'Verify QMS processes are documented and followed.',
 ['iso9001','quality','qms'], CURRENT_TIMESTAMP()),

('ISO_9001', 'ISO 9001 Quality Management Systems', '2015', 'Global', 'Quality Management',
 'https://www.iso.org/iso-9001-quality-management.html',
 'Risk-based thinking and planning',
 '6.1', 'Plan actions to address risks and opportunities that could affect QMS.',
 ['Risk register','Risk assessments','Mitigation plans'],
 'Verify risk identification, assessment, and mitigation planning processes.',
 ['iso9001','risk management','planning','opportunities'], CURRENT_TIMESTAMP()),

('ISO_9001', 'ISO 9001 Quality Management Systems', '2015', 'Global', 'Quality Management',
 'https://www.iso.org/iso-9001-quality-management.html',
 'Customer satisfaction monitoring',
 '9.1.2', 'Monitor information relating to customer perception and satisfaction.',
 ['Customer feedback records','Satisfaction surveys','Complaint handling'],
 'Test customer satisfaction monitoring and feedback collection processes.',
 ['iso9001','customer satisfaction','monitoring','feedback'], CURRENT_TIMESTAMP()),

('ISO_9001', 'ISO 9001 Quality Management Systems', '2015', 'Global', 'Quality Management',
 'https://www.iso.org/iso-9001-quality-management.html',
 'Internal audit requirements',
 '9.2', 'Conduct internal audits to verify QMS effectiveness and compliance.',
 ['Audit programs','Audit reports','Corrective actions'],
 'Verify internal audit program identifies nonconformities and drives improvement.',
 ['iso9001','internal audit','compliance','nonconformities'], CURRENT_TIMESTAMP()),

('ISO_9001', 'ISO 9001 Quality Management Systems', '2015', 'Global', 'Quality Management',
 'https://www.iso.org/iso-9001-quality-management.html',
 'Continual improvement requirements',
 '10.3', 'Continually improve QMS suitability, adequacy, and effectiveness.',
 ['Improvement initiatives','Performance metrics','Management review records'],
 'Test continual improvement processes and effectiveness measurement.',
 ['iso9001','continual improvement','performance','effectiveness'], CURRENT_TIMESTAMP());

-- ISO 13485 (Medical Devices Quality Management) - Enhanced
INSERT INTO `skillful-jetty-467110-v3.healthtest_ai_dataset.compliance_standards`
(standard_id, standard_name, standard_version, jurisdiction, category, source_url, raw_text,
 requirement_id, requirement_text, evidence_needed, testing_guidance, keywords, last_updated)
VALUES
('ISO_13485', 'ISO 13485 Medical Devices Quality Management', '2016', 'Global', 'Medical Device Quality',
 'https://www.iso.org/standard/59752.html',
 'Clause 7: Product realization – risk management and design controls',
 '7.3.2', 'Implement design and development planning for medical devices.',
 ['Risk management file','Design plan'],
 'Verify design inputs, risk controls, and outputs are documented.',
 ['iso13485','medical device','quality'], CURRENT_TIMESTAMP()),

('ISO_13485', 'ISO 13485 Medical Devices Quality Management', '2016', 'Global', 'Medical Device Quality',
 'https://www.iso.org/standard/59752.html',
 'Risk management integration',
 '7.1', 'Apply risk management throughout product realization.',
 ['Risk management plans','Risk analysis reports','Risk control measures'],
 'Verify risk management is integrated throughout product development lifecycle.',
 ['iso13485','risk management','product realization','lifecycle'], CURRENT_TIMESTAMP()),

('ISO_13485', 'ISO 13485 Medical Devices Quality Management', '2016', 'Global', 'Medical Device Quality',
 'https://www.iso.org/standard/59752.html',
 'Design and development validation',
 '7.3.6', 'Perform validation to ensure resulting product meets specified application.',
 ['Validation protocols','Clinical data','Performance verification'],
 'Verify design validation demonstrates product meets intended use requirements.',
 ['iso13485','validation','clinical data','intended use'], CURRENT_TIMESTAMP()),

('ISO_13485', 'ISO 13485 Medical Devices Quality Management', '2016', 'Global', 'Medical Device Quality',
 'https://www.iso.org/standard/59752.html',
 'Traceability requirements',
 '7.5.9', 'Establish procedures for traceability when required.',
 ['Traceability procedures','Unique device identification','Records retention'],
 'Verify traceability systems track products through distribution chain.',
 ['iso13485','traceability','device identification','distribution'], CURRENT_TIMESTAMP());

-- ISO 27001 (Information Security Management) - Enhanced
INSERT INTO `skillful-jetty-467110-v3.healthtest_ai_dataset.compliance_standards`
(standard_id, standard_name, standard_version, jurisdiction, category, source_url, raw_text,
 requirement_id, requirement_text, evidence_needed, testing_guidance, keywords, last_updated)
VALUES
('ISO_27001', 'ISO 27001 Information Security Management', '2022', 'Global', 'Information Security',
 'https://www.iso.org/isoiec-27001-information-security.html',
 'Annex A controls for access management, logging, and encryption',
 'A.9.2', 'User access provisioning shall be formally managed.',
 ['Access request records','User account reviews'],
 'Verify user access provisioning and review process.',
 ['iso27001','information security','access control'], CURRENT_TIMESTAMP()),

('ISO_27001', 'ISO 27001 Information Security Management', '2022', 'Global', 'Information Security',
 'https://www.iso.org/isoiec-27001-information-security.html',
 'Information security incident management',
 'A.5.26', 'Detect, report and assess information security incidents.',
 ['Incident response procedures','Security incident logs','Escalation processes'],
 'Test incident detection, reporting, and response procedures.',
 ['iso27001','incident management','security incidents','response'], CURRENT_TIMESTAMP()),

('ISO_27001', 'ISO 27001 Information Security Management', '2022', 'Global', 'Information Security',
 'https://www.iso.org/isoiec-27001-information-security.html',
 'Cryptography controls',
 'A.8.24', 'Use cryptography to protect confidentiality, authenticity, and integrity.',
 ['Cryptographic policies','Key management procedures','Encryption implementation'],
 'Verify cryptographic controls and key management processes.',
 ['iso27001','cryptography','encryption','key management'], CURRENT_TIMESTAMP()),

('ISO_27001', 'ISO 27001 Information Security Management', '2022', 'Global', 'Information Security',
 'https://www.iso.org/isoiec-27001-information-security.html',
 'Vulnerability management',
 'A.8.8', 'Detect technical vulnerabilities and take appropriate measures.',
 ['Vulnerability scanning reports','Patch management logs','Risk assessments'],
 'Test vulnerability detection and remediation processes.',
 ['iso27001','vulnerability management','scanning','patches'], CURRENT_TIMESTAMP());

-- ==========================
-- Additional Healthcare Standards
-- ==========================

-- IEC 62366 (Usability Engineering for Medical Devices)
INSERT INTO `skillful-jetty-467110-v3.healthtest_ai_dataset.compliance_standards`
(standard_id, standard_name, standard_version, jurisdiction, category, source_url, raw_text,
 requirement_id, requirement_text, evidence_needed, testing_guidance, keywords, last_updated)
VALUES
('IEC_62366', 'IEC 62366 Medical Devices Usability Engineering', '2015', 'Global', 'Medical Device Usability',
 'https://www.iso.org/standard/63179.html',
 'Usability engineering process requirements',
 '5.1', 'Apply usability engineering throughout medical device development.',
 ['Usability engineering file','User interface analysis','Use scenarios'],
 'Verify usability engineering process is applied throughout development.',
 ['iec62366','usability','user interface','medical device'], CURRENT_TIMESTAMP()),

('IEC_62366', 'IEC 62366 Medical Devices Usability Engineering', '2015', 'Global', 'Medical Device Usability',
 'https://www.iso.org/standard/63179.html',
 'User interface testing requirements',
 '5.8', 'Conduct formative and summative evaluations of user interface.',
 ['Usability test protocols','User testing results','Interface evaluations'],
 'Test user interface through formative and summative evaluations.',
 ['iec62366','user testing','interface evaluation','usability testing'], CURRENT_TIMESTAMP());

-- ISO 14971 (Medical Device Risk Management)
INSERT INTO `skillful-jetty-467110-v3.healthtest_ai_dataset.compliance_standards`
(standard_id, standard_name, standard_version, jurisdiction, category, source_url, raw_text,
 requirement_id, requirement_text, evidence_needed, testing_guidance, keywords, last_updated)
VALUES
('ISO_14971', 'ISO 14971 Medical Devices Risk Management', '2019', 'Global', 'Medical Device Risk Management',
 'https://www.iso.org/standard/72704.html',
 'Risk management process requirements',
 '4.2', 'Establish, document and maintain risk management process.',
 ['Risk management plan','Risk management file','Process procedures'],
 'Verify comprehensive risk management process is established and maintained.',
 ['iso14971','risk management','process','medical device'], CURRENT_TIMESTAMP()),

('ISO_14971', 'ISO 14971 Medical Devices Risk Management', '2019', 'Global', 'Medical Device Risk Management',
 'https://www.iso.org/standard/72704.html',
 'Risk analysis requirements',
 '5.1', 'Identify intended use and reasonably foreseeable misuse.',
 ['Intended use specification','Misuse scenarios','Risk analysis'],
 'Verify identification of intended use and foreseeable misuse scenarios.',
 ['iso14971','risk analysis','intended use','misuse'], CURRENT_TIMESTAMP());

-- NIST Cybersecurity Framework
INSERT INTO `skillful-jetty-467110-v3.healthtest_ai_dataset.compliance_standards`
(standard_id, standard_name, standard_version, jurisdiction, category, source_url, raw_text,
 requirement_id, requirement_text, evidence_needed, testing_guidance, keywords, last_updated)
VALUES
('NIST_CSF', 'NIST Cybersecurity Framework', '2.0', 'US', 'Cybersecurity',
 'https://www.nist.gov/cyberframework',
 'Identify function - asset management and governance',
 'ID.AM-1', 'Physical devices and systems are inventoried.',
 ['Asset inventory','Device catalogues','System documentation'],
 'Verify comprehensive inventory of all physical devices and systems.',
 ['nist','cybersecurity','asset management','inventory'], CURRENT_TIMESTAMP()),

('NIST_CSF', 'NIST Cybersecurity Framework', '2.0', 'US', 'Cybersecurity',
 'https://www.nist.gov/cyberframework',
 'Protect function - access control',
 'PR.AC-1', 'Identities and credentials are issued, managed, verified, revoked, and audited.',
 ['Identity management procedures','Credential policies','Access reviews'],
 'Test identity and credential management throughout lifecycle.',
 ['nist','cybersecurity','access control','identity management'], CURRENT_TIMESTAMP());

-- HL7 FHIR Security
INSERT INTO `skillful-jetty-467110-v3.healthtest_ai_dataset.compliance_standards`
(standard_id, standard_name, standard_version, jurisdiction, category, source_url, raw_text,
 requirement_id, requirement_text, evidence_needed, testing_guidance, keywords, last_updated)
VALUES
('HL7_FHIR_SEC', 'HL7 FHIR Security', 'R5', 'Global', 'Healthcare Interoperability Security',
 'https://hl7.org/fhir/security.html',
 'FHIR security implementation requirements',
 'Security-1', 'Implement authentication and authorization for FHIR resources.',
 ['OAuth 2.0 implementation','SMART on FHIR compliance','Access token validation'],
 'Verify FHIR security implementation including OAuth 2.0 and SMART on FHIR.',
 ['hl7','fhir','oauth','smart on fhir','interoperability'], CURRENT_TIMESTAMP()),

('HL7_FHIR_SEC', 'HL7 FHIR Security', 'R5', 'Global', 'Healthcare Interoperability Security',
 'https://hl7.org/fhir/security.html',
 'FHIR audit event requirements',
 'Security-2', 'Generate audit events for FHIR resource access and modifications.',
 ['AuditEvent resources','Access logging','Modification tracking'],
 'Test FHIR AuditEvent generation for resource access and changes.',
 ['hl7','fhir','audit events','resource access','logging'], CURRENT_TIMESTAMP());

