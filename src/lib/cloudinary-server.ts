import { Readable } from "node:stream";

import { v2 as cloudinary } from "cloudinary";

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim(),
  );
}

function configure(): void {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const api_key = process.env.CLOUDINARY_API_KEY?.trim();
  const api_secret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloud_name || !api_key || !api_secret) {
    throw new Error(
      "Cloudinary belum dikonfigurasi. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, dan CLOUDINARY_API_SECRET.",
    );
  }
  cloudinary.config({ cloud_name, api_key, api_secret });
}

export async function uploadSchoolLetterheadImage(opts: {
  schoolId: string;
  buffer: Buffer;
}): Promise<{ secureUrl: string; publicId: string }> {
  configure();
  const folder = `sistem-nilai-ijazah/schools/${opts.schoolId}/letterhead`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        overwrite: false,
        use_filename: false,
        unique_filename: true,
      },
      (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        if (!result?.secure_url || !result.public_id) {
          reject(new Error("Respons Cloudinary tidak lengkap."));
          return;
        }
        resolve({ secureUrl: result.secure_url, publicId: result.public_id });
      },
    );

    Readable.from(opts.buffer).pipe(uploadStream);
  });
}

export async function uploadSubscriptionPaymentProof(opts: {
  schoolId: string;
  buffer: Buffer;
}): Promise<{ secureUrl: string; publicId: string }> {
  configure();
  const folder = `sistem-nilai-ijazah/schools/${opts.schoolId}/subscription-payments`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        overwrite: false,
        use_filename: false,
        unique_filename: true,
      },
      (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        if (!result?.secure_url || !result.public_id) {
          reject(new Error("Respons Cloudinary tidak lengkap."));
          return;
        }
        resolve({ secureUrl: result.secure_url, publicId: result.public_id });
      },
    );

    Readable.from(opts.buffer).pipe(uploadStream);
  });
}

export async function deleteCloudinaryImage(publicId: string | null | undefined): Promise<void> {
  if (!publicId?.trim()) return;
  try {
    configure();
    await cloudinary.uploader.destroy(publicId.trim(), { resource_type: "image" });
  } catch {
    /* abaikan jika aset sudah tidak ada */
  }
}
