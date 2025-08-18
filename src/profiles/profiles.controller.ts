import { Controller, Get, Post, Body, Param, Put } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { CreateProfileDto, UpdateProfileDto } from '../common/dto/profiles.dto';

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get(':id')
  async getProfile(@Param('id') id: string) {
    return this.profilesService.getProfile(id);
  }

  @Post()
  async createProfile(@Body() profileData: CreateProfileDto) {
    return this.profilesService.createProfile(profileData);
  }

  @Put(':id')
  async updateProfile(@Param('id') id: string, @Body() updateData: UpdateProfileDto) {
    return this.profilesService.updateProfile(id, updateData);
  }
}