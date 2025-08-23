export interface CreateProfileDto {
  id: string;
  display_name?: string;
}

export interface UpdateProfileDto {
  display_name?: string;
}
