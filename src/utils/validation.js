import i18n from '../i18n';

/**
 * Client-side input sanitization, field validation, and strict image upload checks.
 * Defense-in-depth layer complementing PostgreSQL constraints and Supabase RLS.
 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_IMAGE_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
export const ALLOWED_IMAGE_EXTENSIONS = Object.freeze(['.jpg', '.jpeg', '.png', '.webp']);

/**
 * Strips HTML tags, script/javascript URI payloads, null bytes, and control chars
 * while preserving readable English, Hindi, and Telugu (Unicode) text.
 */
export function sanitizeText(value, { maxLength = 2000, preserveNewlines = false } = {}) {
  if (value === null || value === undefined) return '';
  let str = String(value);

  // Strip null bytes & unsafe control chars (keep \n and \t if preserveNewlines)
  str = str.replace(/\0/g, '');
  str = preserveNewlines
    ? str.replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    : str.replace(/[\x01-\x1F\x7F]/g, ' ');

  // Remove HTML/script tags and dangerous URI schemes
  str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  str = str.replace(/<[^>]*>/g, '');
  str = str.replace(/(?:javascript|vbscript|data:text\/html)\s*:/gi, '');

  // Collapse excessive spaces
  str = preserveNewlines
    ? str.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
    : str.replace(/\s+/g, ' ');

  str = str.trim();
  if (maxLength > 0 && str.length > maxLength) {
    str = str.slice(0, maxLength);
  }
  return str;
}

/**
 * Sanitizes phone input to digits, leading +, spaces, and hyphens.
 */
export function sanitizePhone(value) {
  const cleaned = String(value || '')
    .replace(/[^\d+\-\s()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20);
  return cleaned;
}

export function isValidPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

export function sanitizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .slice(0, 160);
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(sanitizeEmail(value));
}

export function validateCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { valid: false, error: i18n.t('validation.coordinatesRange') };
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return { valid: false, error: i18n.t('validation.coordinatesRange') };
  }
  return { valid: true, lat, lng, error: '' };
}

/**
 * Shallow-sanitizes string fields on a payload object before persistence.
 */
export function sanitizePayloadStrings(payload, fieldLimits = {}) {
  if (!payload || typeof payload !== 'object') return payload;
  const output = { ...payload };
  for (const [key, val] of Object.entries(output)) {
    if (typeof val !== 'string') continue;
    // Do not corrupt URLs or ISO timestamps or data URLs
    if (
      key.endsWith('_url') ||
      key.endsWith('_at') ||
      key === 'email' ||
      key === 'password' ||
      val.startsWith('data:image/') ||
      val.startsWith('https://') ||
      val.startsWith('http://')
    ) {
      continue;
    }
    if (key.includes('phone')) {
      output[key] = sanitizePhone(val);
    } else {
      const limit = fieldLimits[key] || 1500;
      const preserveNewlines = key === 'description' || key === 'message' || key === 'notes';
      output[key] = sanitizeText(val, { maxLength: limit, preserveNewlines });
    }
  }
  return output;
}

/**
 * Validates incident report form fields and returns sanitized values.
 */
export function validateIncidentForm(form) {
  const fieldErrors = {};
  const title = sanitizeText(form.title, { maxLength: 160 });
  const description = sanitizeText(form.description, { maxLength: 2000, preserveNewlines: true });
  const location_text = sanitizeText(form.location_text, { maxLength: 220 });
  const locality = sanitizeText(form.locality, { maxLength: 80 });
  const contact_phone = sanitizePhone(form.contact_phone);

  if (!form.category) {
    fieldErrors.category = i18n.t('validation.categoryRequired');
  }
  if (title.length < 6) {
    fieldErrors.title = i18n.t('validation.descriptionMinLength', { min: 6 });
  }
  if (description.length < 15) {
    fieldErrors.description = i18n.t('validation.descriptionMinLength', { min: 15 });
  }
  if (location_text.length < 3) {
    fieldErrors.location_text = i18n.t('validation.locationRequired');
  }

  const coordCheck = validateCoordinates(form.latitude, form.longitude);
  if (!coordCheck.valid) {
    fieldErrors.coordinates = coordCheck.error;
  }

  if (!form.observed_at) {
    fieldErrors.observed_at = i18n.t('validation.requiredField', {
      field: i18n.t('incident.observedAtLabel'),
    });
  } else {
    const obsTime = new Date(form.observed_at).getTime();
    if (!Number.isFinite(obsTime) || obsTime > Date.now() + 15 * 60 * 1000) {
      fieldErrors.observed_at = i18n.t('validation.observedFuture', {
        defaultValue: 'Observed date/time cannot be in the future.',
      });
    }
  }

  if (!isValidPhone(contact_phone)) {
    fieldErrors.contact_phone = i18n.t('validation.phoneInvalid');
  }

  const errors = Object.values(fieldErrors);
  return {
    isValid: errors.length === 0,
    firstError: errors[0] || '',
    fieldErrors,
    sanitized: {
      category: form.category,
      title,
      description,
      locality,
      location_text,
      latitude: coordCheck.valid ? coordCheck.lat : Number(form.latitude),
      longitude: coordCheck.valid ? coordCheck.lng : Number(form.longitude),
      severity: form.severity,
      observed_at: form.observed_at,
      contact_phone,
    },
  };
}

/**
 * Validates emergency assistance form fields and returns sanitized values.
 */
export function validateEmergencyForm(form) {
  const fieldErrors = {};
  const requester_name = sanitizeText(form.requester_name, { maxLength: 120 });
  const contact_phone = sanitizePhone(form.contact_phone);
  const locality = sanitizeText(form.locality, { maxLength: 80 });
  const location_text = sanitizeText(form.location_text, { maxLength: 260 });
  const medical_needs = sanitizeText(form.medical_needs, { maxLength: 500 });
  const accessibility_needs = sanitizeText(form.accessibility_needs, { maxLength: 500 });
  const description = sanitizeText(form.description, { maxLength: 2000, preserveNewlines: true });

  if (requester_name.length < 2) {
    fieldErrors.requester_name = i18n.t('validation.nameMinLength');
  }
  if (!isValidPhone(contact_phone)) {
    fieldErrors.contact_phone = i18n.t('validation.phoneInvalid');
  }
  if (location_text.length < 4) {
    fieldErrors.location_text = i18n.t('validation.locationRequired');
  }

  const coordCheck = validateCoordinates(form.latitude, form.longitude);
  if (!coordCheck.valid) {
    fieldErrors.coordinates = coordCheck.error;
  }

  const people = Number(form.people_count);
  const children = Number(form.children_count);
  const elderly = Number(form.elderly_count);
  if (!Number.isInteger(people) || people < 1 || people > 500) {
    fieldErrors.people_count = i18n.t('validation.peopleCountInvalid');
  }
  if (!Number.isInteger(children) || children < 0 || !Number.isInteger(elderly) || elderly < 0) {
    fieldErrors.vulnerable = i18n.t('validation.vulnerableNonNegative', {
      defaultValue: 'Children and elderly counts must be 0 or greater.',
    });
  } else if (Number.isInteger(people) && children + elderly > people) {
    fieldErrors.vulnerable = i18n.t('validation.vulnerableExceedsTotal', {
      defaultValue: 'Combined children and elderly count cannot exceed total people count.',
    });
  }

  if (description.length < 10) {
    fieldErrors.description = i18n.t('validation.descriptionMinLength', { min: 10 });
  }
  if (!form.disclaimerAccepted) {
    fieldErrors.disclaimerAccepted = i18n.t('validation.disclaimerRequired', {
      defaultValue: 'Please acknowledge the emergency response disclaimer before submitting.',
    });
  }

  const errors = Object.values(fieldErrors);
  return {
    isValid: errors.length === 0,
    firstError: errors[0] || '',
    fieldErrors,
    sanitized: {
      requester_name,
      contact_phone,
      locality,
      location_text,
      latitude: coordCheck.valid ? coordCheck.lat : Number(form.latitude),
      longitude: coordCheck.valid ? coordCheck.lng : Number(form.longitude),
      people_count: people,
      children_count: children,
      elderly_count: elderly,
      medical_needs,
      accessibility_needs,
      severity: form.severity,
      description,
      is_trapped: Boolean(form.is_trapped),
    },
  };
}

/**
 * Validates public landing coordination inquiry form.
 */
export function validateContactForm(form) {
  const fieldErrors = {};
  const name = sanitizeText(form.name, { maxLength: 120 });
  const email = sanitizeEmail(form.email);
  const locality = sanitizeText(form.locality, { maxLength: 80 });
  const topic = sanitizeText(form.topic, { maxLength: 100 });
  const message = sanitizeText(form.message, { maxLength: 1500, preserveNewlines: true });

  if (name.length < 2) {
    fieldErrors.name = i18n.t('validation.nameMinLength');
  }
  if (!isValidEmail(email)) {
    fieldErrors.email = i18n.t('validation.emailInvalid');
  }
  if (message.length < 10) {
    fieldErrors.message = i18n.t('validation.descriptionMinLength', { min: 10 });
  }

  const errors = Object.values(fieldErrors);
  return {
    isValid: errors.length === 0,
    firstError: errors[0] || '',
    fieldErrors,
    sanitized: { name, email, locality, topic, message },
  };
}

/**
 * Synchronous MIME, extension, and file-size check for uploaded photos.
 */
export function validateImageFile(file) {
  if (!file) {
    return { valid: false, error: i18n.t('validation.requiredField', { field: i18n.t('common.photo') }) };
  }

  const fileName = String(file.name || '').toLowerCase();
  const hasAllowedExt = ALLOWED_IMAGE_EXTENSIONS.some((ext) => fileName.endsWith(ext));

  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type) || !hasAllowedExt) {
    return {
      valid: false,
      error: i18n.t('validation.imageTypeInvalid'),
    };
  }

  if (file.size <= 0) {
    return { valid: false, error: i18n.t('validation.imageTypeInvalid') };
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return {
      valid: false,
      error: i18n.t('validation.imageSizeTooLarge'),
    };
  }

  return { valid: true, error: '' };
}

/**
 * Asynchronous binary signature (magic bytes) verification so renamed non-image files are rejected.
 */
export async function validateImageMagicBytes(file) {
  const basic = validateImageFile(file);
  if (!basic.valid) return basic;

  try {
    const headerBuffer = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(headerBuffer);
    if (bytes.length < 12) {
      return { valid: false, error: i18n.t('validation.imageTypeInvalid') };
    }

    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng =
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a;
    const isWebp =
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50;

    if (!isJpeg && !isPng && !isWebp) {
      return {
        valid: false,
        error: i18n.t('validation.imageTypeInvalid'),
      };
    }

    return { valid: true, error: '' };
  } catch {
    return basic;
  }
}
