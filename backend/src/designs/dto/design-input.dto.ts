import { Transform, Type } from 'class-transformer';
import {
  IsBoolean, IsIn, IsNotEmpty, IsNumber, IsObject, IsOptional, IsPositive, IsString, Max, MaxLength, Min,
  ValidateNested,
} from 'class-validator';
import { LIMITS } from '../../engine/index.js';

/** CBR (%) of the unbound layers. The DBM is asphalt: it has no CBR (its MR is in mrPsi.dbm). */
export class CbrDto {
  @IsOptional() @IsNumber() @IsPositive() subgrade?: number;
  @IsOptional() @IsNumber() @IsPositive() capping?: number;
  @IsOptional() @IsNumber() @IsPositive() subbase?: number;
  @IsOptional() @IsNumber() @IsPositive() base?: number;
}

/** Resilient modulus MR (psi). mrPsi.dbm (asphalt) is used in both methods. */
export class MrDto {
  @IsOptional() @IsNumber() @IsPositive() subgrade?: number;
  @IsOptional() @IsNumber() @IsPositive() capping?: number;
  @IsOptional() @IsNumber() @IsPositive() subbase?: number;
  @IsOptional() @IsNumber() @IsPositive() base?: number;
  @IsOptional() @IsNumber() @IsPositive() dbm?: number;
}

/** Layer coefficients a1..a5 (a1 must be > 0; 0 is allowed for the others). */
export class CoefficientsDto {
  @IsOptional() @IsNumber() @IsPositive() @Max(LIMITS.aAc[1]) ac?: number;
  @IsOptional() @IsNumber() @Min(LIMITS.a[0]) @Max(LIMITS.a[1]) dbm?: number;
  @IsOptional() @IsNumber() @Min(LIMITS.a[0]) @Max(LIMITS.a[1]) base?: number;
  @IsOptional() @IsNumber() @Min(LIMITS.a[0]) @Max(LIMITS.a[1]) subbase?: number;
  @IsOptional() @IsNumber() @Min(LIMITS.a[0]) @Max(LIMITS.a[1]) capping?: number;
}

/** Drainage coefficients m3..m5 (AASHTO 1993 Table 2.4 range 0.4–1.4). AC and DBM are asphalt: m = 1, so m.dbm is ignored. */
export class DrainageDto {
  @IsOptional() @IsNumber() @Min(LIMITS.m[0]) @Max(LIMITS.m[1]) dbm?: number;
  @IsOptional() @IsNumber() @Min(LIMITS.m[0]) @Max(LIMITS.m[1]) base?: number;
  @IsOptional() @IsNumber() @Min(LIMITS.m[0]) @Max(LIMITS.m[1]) subbase?: number;
  @IsOptional() @IsNumber() @Min(LIMITS.m[0]) @Max(LIMITS.m[1]) capping?: number;
}

/** Chosen thickness (mm) per layer; leave out (or null) to use the suggested minimum. */
export class ThicknessDto {
  @IsOptional() @IsNumber() @Min(LIMITS.thicknessMm[0]) @Max(LIMITS.thicknessMm[1]) ac?: number | null;
  @IsOptional() @IsNumber() @Min(LIMITS.thicknessMm[0]) @Max(LIMITS.thicknessMm[1]) dbm?: number | null;
  @IsOptional() @IsNumber() @Min(LIMITS.thicknessMm[0]) @Max(LIMITS.thicknessMm[1]) base?: number | null;
  @IsOptional() @IsNumber() @Min(LIMITS.thicknessMm[0]) @Max(LIMITS.thicknessMm[1]) subbase?: number | null;
  @IsOptional() @IsNumber() @Min(LIMITS.thicknessMm[0]) @Max(LIMITS.thicknessMm[1]) capping?: number | null;
}

/** All design inputs. Every field is optional; missing values use the notebook defaults. */
export class DesignInputDto {
  @IsOptional() @IsNumber() @Min(LIMITS.reliability[0]) @Max(LIMITS.reliability[1]) reliability?: number;
  @IsOptional() @IsNumber() @IsPositive() @Max(LIMITS.so[1]) so?: number;
  @IsOptional() @IsNumber() @IsPositive() w18?: number;
  @IsOptional() @IsNumber() @IsPositive() @Max(LIMITS.dpsi[1]) dpsi?: number;
  @IsOptional() @IsBoolean() useDbmLayer?: boolean;
  @IsOptional() @IsBoolean() useCappingLayer?: boolean;
  @IsOptional() @IsIn(['cbr', 'mr']) mrMethod?: 'cbr' | 'mr';

  @IsOptional() @IsObject() @ValidateNested() @Type(() => CbrDto) cbr?: CbrDto;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => MrDto) mrPsi?: MrDto;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => CoefficientsDto) a?: CoefficientsDto;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => DrainageDto) m?: DrainageDto;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => ThicknessDto) thicknessMm?: ThicknessDto;

  @IsOptional() @IsNumber() @IsPositive() @Max(1000) roundUpToMm?: number | null;
  @IsOptional() @IsBoolean() enforceAashtoMinimums?: boolean;
}

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** POST /projects/:projectId/designs body. */
export class CreateDesignDto {
  @Transform(trim) @IsString() @IsNotEmpty({ message: 'Give the design a name' }) @MaxLength(150)
  name: string;

  @IsObject() @ValidateNested() @Type(() => DesignInputDto)
  inputs: DesignInputDto;
}

/** PATCH /designs/:id body: rename and/or change inputs (the result is recalculated). */
export class UpdateDesignDto {
  @Transform(trim) @IsOptional() @IsString() @IsNotEmpty({ message: 'The design name cannot be empty' }) @MaxLength(150)
  name?: string;

  @IsOptional() @IsObject() @ValidateNested() @Type(() => DesignInputDto)
  inputs?: DesignInputDto;
}
