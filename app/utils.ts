export function pick<T extends object, U extends keyof T>(object: T, ...props: U[]): Pick<T, U> {
    return props.reduce((o, k) => ((o[k] = object[k]), o), {} as any);
}
export function omit<T extends object, U extends keyof T>(object: T, ...props: U[]): Omit<T, U> {
    return Object.keys(object)
        .filter((key) => (props as string[]).indexOf(key) < 0)
        .reduce((newObj, key) => Object.assign(newObj, { [key]: object[key] }), {} as any);
}

const verRegex = /^v?(\d+)\.(\d+)\.(\d+)([a-z])?$/;
export function versionCompare(v1: string, v2: string) {
    const match1 = v1.match(verRegex);
    const match2 = v2.match(verRegex);
    if (!match1 || !match2) {
        return NaN;
    }
    const l1 = match1.length;
    const l2 = match2.length;
    //fixed to 5 as we now
    for (let i = 1; i < l1; ++i) {
        if (l2 === i) {
            return 1;
        }
        let num1 = parseInt(match1[i], 10);
        if (isNaN(num1)) {
            num1 = match1[i].charCodeAt(0);
        }
        let num2 = parseInt(match2[i], 10);
        if (isNaN(num2)) {
            num2 = match2[i].charCodeAt(0);
        }
        if (num1 === num2) {
            continue;
        } else if (num1 > num2) {
            return 1;
        } else {
            return -1;
        }
    }

    if (l1 !== l2) {
        return -1;
    }

    return 0;
}
