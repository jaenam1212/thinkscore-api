import {
  IsString,
  IsNotEmpty,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate,
} from "class-validator";

@ValidatorConstraint({ name: "testEmailAllowed", async: false })
class TestEmailValidator implements ValidatorConstraintInterface {
  validate(email: string) {
    // 개발 환경에서는 테스트 이메일 허용
    if (process.env.NODE_ENV === "development" && email === "12@12.12") {
      return true;
    }
    // 일반적인 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  defaultMessage() {
    return "Invalid email format";
  }
}

export class LoginDto {
  @Validate(TestEmailValidator)
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
