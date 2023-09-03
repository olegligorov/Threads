import * as z from 'zod';

export const UserValidation = z.object({
    profile_photo: z.string().url().nonempty(),
    name: z.string().min(2).max(40),
    username: z.string().min(2).max(40),
    bio: z.string().min(2).max(1000),
});