
export default function isEchoOfInput(lastInput, output) {
    if (!lastInput || !output) return false;

    const clean = (str) =>
        str
            // remove ANSI escape codes like \x1B[2;17R
            .replace(/\x1B\[[0-9;?]*[A-Za-z]/g, "")
            // remove carriage returns and newlines
            .replace(/\r?\n/g, "")
            // remove extra spaces
            .trim();

    const cleanedInput = clean(lastInput);
    const cleanedOutput = clean(output);

    if (!cleanedInput || !cleanedOutput) return false;

    // Return true if output starts with input or they are equal
    return (
        cleanedOutput === cleanedInput ||
        cleanedOutput.startsWith(cleanedInput)
    );
}
