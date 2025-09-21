import * as functions from 'firebase-functions';
import type { Request, Response } from 'express';
import { DlpServiceClient } from '@google-cloud/dlp';
import { admin } from './firebaseApp';
import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';

const dlp = new DlpServiceClient();

setGlobalOptions({
  region: 'us-central1',
  // maxInstances: 10,
});

export const dlpDeidentify = onRequest(
  {
    cpu: 2,
    memory: '2GiB',
    timeoutSeconds: 540,
  },
  async (req, res) => {
  try {
    const { text, policy } = req.body as { text?: string; policy?: 'redact' | 'tokenize' | 'encrypt' };

    if (!text || !policy) {
      res.status(400).json({ error: 'Missing text or policy (redact|tokenize|encrypt expected)' });
      return;
    }

    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || process.env.PROJECT_ID;
    if (!projectId) {
      res.status(500).json({ error: 'Missing GCP project id in env (GCLOUD_PROJECT / GCP_PROJECT / PROJECT_ID)' });
      return;
    }

    const parent = `projects/${projectId}/locations/global`;

    const inspectConfig = {
      infoTypes: [
        { name: 'PERSON_NAME' },
        { name: 'EMAIL_ADDRESS' },
        { name: 'PHONE_NUMBER' },
        { name: 'US_SOCIAL_SECURITY_NUMBER' },
        { name: 'DATE_OF_BIRTH' }
      ],
      includeQuote: false
    };

    let deidentifyConfig: any;

    if (policy === 'redact') {
      deidentifyConfig = {
        infoTypeTransformations: {
          transformations: [
            {
              primitiveTransformation: {
                replaceWithInfoTypeConfig: {}
              }
            }
          ]
        }
      };
    } else if (policy === 'tokenize') {
      // Example deterministic crypto config using KMS key name from env
      const kmsKeyName = process.env.KMS_KEY_NAME;
      if (!kmsKeyName) {
        res.status(500).json({ error: 'KMS_KEY_NAME env not set for tokenize policy' });
        return;
      }
      deidentifyConfig = {
        infoTypeTransformations: {
          transformations: [
            {
              primitiveTransformation: {
                cryptoDeterministicConfig: {
                  cryptoKey: {
                    kmsWrapped: {
                      cryptoKeyName: kmsKeyName
                    }
                  },
                  surrogateInfoType: { name: 'DEID_TOKEN' }
                }
              }
            }
          ]
        }
      };
    } else {
      // encrypt / fallback to character mask
      deidentifyConfig = {
        infoTypeTransformations: {
          transformations: [
            {
              primitiveTransformation: {
                characterMaskConfig: {
                  maskingCharacter: '*',
                  numberToMask: 0 // mask entire match
                }
              }
            }
          ]
        }
      };
    }

    const [response] = await dlp.deidentifyContent({
      parent,
      inspectConfig,
      deidentifyConfig,
      item: { value: text }
    });

    const deidentifiedText = response.item?.value ?? '';
    res.json({ deidentifiedText, infoTypeStats: response.overview ?? {} });
  } catch (err: any) {
    console.error('DLP error:', err);
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});
