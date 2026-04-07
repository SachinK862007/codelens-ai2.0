const mk = (id, title, statement, expectedBehavior) => ({
  id,
  title,
  statement,
  expectedBehavior
});

// At least 10 per language, randomized in UI.
export const PRACTICE_QUESTIONS = {
  python: [
    mk("py-1", "Hello", "Print a greeting message.", "Program prints a greeting line."),
    mk("py-2", "Sum", "Read two integers and output their sum.", "Correct sum for any two integers."),
    mk("py-3", "Max of 3", "Read three integers and output the maximum.", "Outputs the largest of three numbers."),
    mk("py-4", "Even/Odd", "Read an integer and print whether it's even or odd.", "Correctly classifies even vs odd."),
    mk("py-5", "Count vowels", "Read a string and output the number of vowels (a,e,i,o,u).", "Counts vowels case-insensitively."),
    mk("py-6", "Reverse string", "Read a string and print it reversed.", "Outputs the reversed string."),
    mk("py-7", "Factorial", "Read n and print n! for n>=0.", "Computes factorial correctly."),
    mk("py-8", "FizzBuzz", "Print numbers 1..n with Fizz/Buzz rules.", "Applies standard FizzBuzz rules."),
    mk("py-9", "Unique count", "Read a list of integers and output how many unique values.", "Counts unique values correctly."),
    mk("py-10", "Palindrome", "Read a string and print if it is a palindrome (ignore case/spaces).", "Detects palindromes ignoring case/spaces.")
  ],
  c: [
    mk("c-1", "Hello", "Print a greeting message.", "Program prints a greeting line."),
    mk("c-2", "Sum", "Read two integers and output their sum.", "Correct sum for any two integers."),
    mk("c-3", "Max of 3", "Read three integers and output the maximum.", "Outputs the largest of three numbers."),
    mk("c-4", "Even/Odd", "Read an integer and print whether it's even or odd.", "Correctly classifies even vs odd."),
    mk("c-5", "Array sum", "Read n and then n integers; output their sum.", "Sums all n integers."),
    mk("c-6", "Min", "Read n and output the minimum value.", "Finds minimum correctly."),
    mk("c-7", "Count digits", "Read an integer and output the number of digits.", "Counts digits including 0 and negatives."),
    mk("c-8", "Leap year", "Read a year and print whether it's a leap year.", "Uses correct leap year rules."),
    mk("c-9", "Reverse number", "Read an integer and output its digits reversed.", "Reverses digits correctly."),
    mk("c-10", "Palindrome number", "Read an integer and print if it's a palindrome.", "Detects numeric palindrome correctly.")
  ],
  cpp: [
    mk("cpp-1", "Hello", "Print a greeting message.", "Program prints a greeting line."),
    mk("cpp-2", "Sum", "Read two integers and output their sum.", "Correct sum for any two integers."),
    mk("cpp-3", "Max of 3", "Read three integers and output the maximum.", "Outputs the largest of three numbers."),
    mk("cpp-4", "Even/Odd", "Read an integer and print whether it's even or odd.", "Correctly classifies even vs odd."),
    mk("cpp-5", "Count vowels", "Read a string and output vowel count.", "Counts vowels case-insensitively."),
    mk("cpp-6", "Reverse string", "Read a string and print it reversed.", "Outputs reversed string."),
    mk("cpp-7", "Factorial", "Read n and print n!.", "Computes factorial correctly."),
    mk("cpp-8", "Second largest", "Read n and n integers; output the second largest.", "Finds second largest correctly."),
    mk("cpp-9", "Palindrome", "Read a string and print if palindrome (ignore case/spaces).", "Detects palindromes ignoring case/spaces."),
    mk("cpp-10", "Frequency", "Read n integers and output the most frequent value.", "Finds mode correctly (any tie acceptable).")
  ],
  javascript: [
    mk("js-1", "Hello", "Print a greeting message.", "Program prints a greeting line."),
    mk("js-2", "Sum", "Read two integers and output their sum.", "Correct sum for any two integers."),
    mk("js-3", "Max of 3", "Read three integers and output the maximum.", "Outputs the largest of three numbers."),
    mk("js-4", "Even/Odd", "Read an integer and print whether it's even or odd.", "Correctly classifies even vs odd."),
    mk("js-5", "Count vowels", "Read a string and output vowel count.", "Counts vowels case-insensitively."),
    mk("js-6", "Reverse string", "Read a string and print it reversed.", "Outputs reversed string."),
    mk("js-7", "Factorial", "Read n and print n! for n>=0.", "Computes factorial correctly."),
    mk("js-8", "FizzBuzz", "Print numbers 1..n with Fizz/Buzz rules.", "Applies standard FizzBuzz rules."),
    mk("js-9", "Unique count", "Read a list and output unique count.", "Counts unique values correctly."),
    mk("js-10", "Palindrome", "Read a string and print if palindrome (ignore case/spaces).", "Detects palindromes ignoring case/spaces.")
  ],
  typescript: [
    mk("ts-1", "Hello", "Print a greeting message.", "Program prints a greeting line."),
    mk("ts-2", "Sum", "Read two integers and output their sum.", "Correct sum for any two integers."),
    mk("ts-3", "Max of 3", "Read three integers and output the maximum.", "Outputs the largest of three numbers."),
    mk("ts-4", "Even/Odd", "Read an integer and print whether it's even or odd.", "Correctly classifies even vs odd."),
    mk("ts-5", "Count vowels", "Read a string and output vowel count.", "Counts vowels case-insensitively."),
    mk("ts-6", "Reverse string", "Read a string and print it reversed.", "Outputs reversed string."),
    mk("ts-7", "Factorial", "Read n and print n!.", "Computes factorial correctly."),
    mk("ts-8", "FizzBuzz", "Print numbers 1..n with Fizz/Buzz rules.", "Applies standard FizzBuzz rules."),
    mk("ts-9", "Unique count", "Read numbers and output unique count.", "Counts unique values correctly."),
    mk("ts-10", "Palindrome", "Read a string and print if palindrome.", "Detects palindromes ignoring case/spaces.")
  ],
  java: [
    mk("java-1", "Hello", "Print a greeting message.", "Program prints a greeting line."),
    mk("java-2", "Sum", "Read two integers and output their sum.", "Correct sum for any two integers."),
    mk("java-3", "Max of 3", "Read three integers and output the maximum.", "Outputs the largest of three numbers."),
    mk("java-4", "Even/Odd", "Read an integer and print whether it's even or odd.", "Correctly classifies even vs odd."),
    mk("java-5", "Count vowels", "Read a string and output vowel count.", "Counts vowels case-insensitively."),
    mk("java-6", "Reverse string", "Read a string and print it reversed.", "Outputs reversed string."),
    mk("java-7", "Factorial", "Read n and print n!.", "Computes factorial correctly."),
    mk("java-8", "Prime check", "Read n and print if prime.", "Correctly checks primality for n>=2."),
    mk("java-9", "Palindrome", "Read a string and print if palindrome (ignore case/spaces).", "Detects palindromes ignoring case/spaces."),
    mk("java-10", "Fibonacci", "Read n and print first n Fibonacci numbers.", "Generates Fibonacci sequence correctly.")
  ],
  go: [
    mk("go-1", "Hello", "Print a greeting message.", "Program prints a greeting line."),
    mk("go-2", "Sum", "Read two integers and output their sum.", "Correct sum for any two integers."),
    mk("go-3", "Max of 3", "Read three integers and output the maximum.", "Outputs the largest of three numbers."),
    mk("go-4", "Even/Odd", "Read an integer and print whether it's even or odd.", "Correctly classifies even vs odd."),
    mk("go-5", "Count vowels", "Read a string and output vowel count.", "Counts vowels case-insensitively."),
    mk("go-6", "Reverse string", "Read a string and print it reversed.", "Outputs reversed string."),
    mk("go-7", "Factorial", "Read n and print n!.", "Computes factorial correctly."),
    mk("go-8", "Prime check", "Read n and print if prime.", "Correctly checks primality."),
    mk("go-9", "Unique count", "Read integers and output unique count.", "Counts unique values correctly."),
    mk("go-10", "Palindrome", "Read a string and print if palindrome (ignore case/spaces).", "Detects palindromes ignoring case/spaces.")
  ],
  rust: [
    mk("rs-1", "Hello", "Print a greeting message.", "Program prints a greeting line."),
    mk("rs-2", "Sum", "Read two integers and output their sum.", "Correct sum for any two integers."),
    mk("rs-3", "Max of 3", "Read three integers and output the maximum.", "Outputs the largest of three numbers."),
    mk("rs-4", "Even/Odd", "Read an integer and print whether it's even or odd.", "Correctly classifies even vs odd."),
    mk("rs-5", "Count vowels", "Read a string and output vowel count.", "Counts vowels case-insensitively."),
    mk("rs-6", "Reverse string", "Read a string and print it reversed.", "Outputs reversed string."),
    mk("rs-7", "Factorial", "Read n and print n!.", "Computes factorial correctly."),
    mk("rs-8", "Prime check", "Read n and print if prime.", "Correctly checks primality."),
    mk("rs-9", "Unique count", "Read integers and output unique count.", "Counts unique values correctly."),
    mk("rs-10", "Palindrome", "Read a string and print if palindrome (ignore case/spaces).", "Detects palindromes ignoring case/spaces.")
  ],
  php: [
    mk("php-1", "Hello", "Print a greeting message.", "Program prints a greeting line."),
    mk("php-2", "Sum", "Read two integers and output their sum.", "Correct sum for any two integers."),
    mk("php-3", "Max of 3", "Read three integers and output the maximum.", "Outputs the largest of three numbers."),
    mk("php-4", "Even/Odd", "Read an integer and print whether it's even or odd.", "Correctly classifies even vs odd."),
    mk("php-5", "Count vowels", "Read a string and output vowel count.", "Counts vowels case-insensitively."),
    mk("php-6", "Reverse string", "Read a string and print it reversed.", "Outputs reversed string."),
    mk("php-7", "Factorial", "Read n and print n!.", "Computes factorial correctly."),
    mk("php-8", "Prime check", "Read n and print if prime.", "Correctly checks primality."),
    mk("php-9", "Unique count", "Read integers and output unique count.", "Counts unique values correctly."),
    mk("php-10", "Palindrome", "Read a string and print if palindrome (ignore case/spaces).", "Detects palindromes ignoring case/spaces.")
  ],
  swift: [
    mk("sw-1", "Hello", "Print a greeting message.", "Program prints a greeting line."),
    mk("sw-2", "Sum", "Read two integers and output their sum.", "Correct sum for any two integers."),
    mk("sw-3", "Max of 3", "Read three integers and output the maximum.", "Outputs the largest of three numbers."),
    mk("sw-4", "Even/Odd", "Read an integer and print whether it's even or odd.", "Correctly classifies even vs odd."),
    mk("sw-5", "Count vowels", "Read a string and output vowel count.", "Counts vowels case-insensitively."),
    mk("sw-6", "Reverse string", "Read a string and print it reversed.", "Outputs reversed string."),
    mk("sw-7", "Factorial", "Read n and print n!.", "Computes factorial correctly."),
    mk("sw-8", "Prime check", "Read n and print if prime.", "Correctly checks primality."),
    mk("sw-9", "Unique count", "Read integers and output unique count.", "Counts unique values correctly."),
    mk("sw-10", "Palindrome", "Read a string and print if palindrome (ignore case/spaces).", "Detects palindromes ignoring case/spaces.")
  ],
  kotlin: [
    mk("kt-1", "Hello", "Print a greeting message.", "Program prints a greeting line."),
    mk("kt-2", "Sum", "Read two integers and output their sum.", "Correct sum for any two integers."),
    mk("kt-3", "Max of 3", "Read three integers and output the maximum.", "Outputs the largest of three numbers."),
    mk("kt-4", "Even/Odd", "Read an integer and print whether it's even or odd.", "Correctly classifies even vs odd."),
    mk("kt-5", "Count vowels", "Read a string and output vowel count.", "Counts vowels case-insensitively."),
    mk("kt-6", "Reverse string", "Read a string and print it reversed.", "Outputs reversed string."),
    mk("kt-7", "Factorial", "Read n and print n!.", "Computes factorial correctly."),
    mk("kt-8", "Prime check", "Read n and print if prime.", "Correctly checks primality."),
    mk("kt-9", "Unique count", "Read integers and output unique count.", "Counts unique values correctly."),
    mk("kt-10", "Palindrome", "Read a string and print if palindrome (ignore case/spaces).", "Detects palindromes ignoring case/spaces.")
  ],
  html: [
    mk("html-1", "Basic page", "Create a simple HTML page with a heading and paragraph.", "Has semantic structure and shows content."),
    mk("html-2", "Form", "Create a form with name/email inputs and a submit button.", "Includes proper labels and inputs."),
    mk("html-3", "List", "Create an ordered list of three items.", "Renders an ordered list with 3 items."),
    mk("html-4", "Table", "Create a 2x2 table with headers.", "Renders a table with headers and 2 rows."),
    mk("html-5", "Image", "Add an image with alt text.", "Uses img tag with non-empty alt."),
    mk("html-6", "Nav", "Create a nav with three links.", "Uses nav element and anchor tags."),
    mk("html-7", "Card", "Create a card layout with title and description.", "Has container with title/description."),
    mk("html-8", "Sectioning", "Use header/main/footer properly.", "Uses header/main/footer tags."),
    mk("html-9", "Accessibility", "Create a button and ensure it is accessible.", "Uses button element and readable text."),
    mk("html-10", "Embed", "Embed a YouTube iframe responsively.", "Has iframe and responsive wrapper.")
  ],
  css: [
    mk("css-1", "Center", "Center a div both vertically and horizontally.", "Uses flex/grid to center correctly."),
    mk("css-2", "Button", "Style a button with hover state.", "Button has hover transition."),
    mk("css-3", "Card", "Create a card with shadow and rounded corners.", "Card has border-radius and box-shadow."),
    mk("css-4", "Responsive", "Make a layout stack on mobile.", "Uses media queries or responsive units."),
    mk("css-5", "Typography", "Set base font and heading scale.", "Defines readable font sizes."),
    mk("css-6", "Grid", "Create a 3-column grid with gap.", "Uses CSS grid with columns."),
    mk("css-7", "Navbar", "Create a horizontal navbar.", "Uses flex and spacing."),
    mk("css-8", "Dark mode", "Add styles for dark mode.", "Uses prefers-color-scheme or class."),
    mk("css-9", "Animation", "Animate a loading spinner.", "Uses keyframes properly."),
    mk("css-10", "Badge", "Create a pill-shaped badge.", "Has border-radius 999px and padding.")
  ]
};

export const PRACTICE_LANGUAGES = [
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "python", label: "Python" },
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "javascript", label: "JavaScript" },
  { id: "java", label: "Java" },
  { id: "typescript", label: "TypeScript" },
  { id: "rust", label: "Rust" },
  { id: "go", label: "Go" },
  { id: "php", label: "PHP" },
  { id: "swift", label: "Swift" },
  { id: "kotlin", label: "Kotlin" }
];

