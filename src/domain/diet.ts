import type { DietFlag, Food } from './types';

const BANS_SOFT_BREAD: DietFlag[] = ['no_soft_bread', 'no_bread'];

export function migrateDietFlags(flags: readonly string[]): DietFlag[] {
  const next: DietFlag[] = [];
  const seen = new Set<string>();
  for (const flag of flags) {
    const mapped = flag === 'no_bread' ? 'no_soft_bread' : flag;
    if (seen.has(mapped)) continue;
    seen.add(mapped);
    next.push(mapped as DietFlag);
  }
  return next;
}

function bansSoftBread(flags: DietFlag[]): boolean {
  return flags.some((flag) => BANS_SOFT_BREAD.includes(flag));
}

function isSoftBread(food: Food): boolean {
  return food.tags.includes('soft_bread') || food.tags.includes('bread');
}

/** Hide foods whose exclusion flags overlap the user's diet flags. */
export function isFoodAllowed(food: Food, flags: DietFlag[]): boolean {
  const hapankorppuOk = food.tags.includes('hapankorppu_exception_small');
  if (hapankorppuOk) {
    const otherExclusions = food.excluded_by_flags.filter(
      (flag) => !BANS_SOFT_BREAD.includes(flag),
    );
    if (otherExclusions.some((flag) => flags.includes(flag))) {
      return false;
    }
  } else {
    if (food.excluded_by_flags.some((flag) => flags.includes(flag))) {
      return false;
    }
    if (bansSoftBread(flags) && isSoftBread(food)) {
      return false;
    }
  }
  if (food.tags.includes('egg') && !flags.includes('eggs_ok')) {
    return false;
  }
  if (food.tags.includes('fish') && !flags.includes('fish_ok')) {
    return false;
  }
  return true;
}

export function filterCatalog(foods: Food[], flags: DietFlag[]): Food[] {
  return foods.filter((food) => isFoodAllowed(food, flags));
}

export function searchFoods(foods: Food[], query: string): Food[] {
  const q = query.trim().toLocaleLowerCase('fi-FI');
  if (!q) return foods;
  return foods.filter((food) => {
    const hay = [food.name_fi, food.name_en, food.brand, ...(food.aliases ?? []), ...food.tags]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('fi-FI');
    return hay.includes(q);
  });
}
