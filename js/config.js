/* ============================================================
   CODEPROCT — CONFIG.JS
   Platform configuration, questions, and starter templates
   ============================================================ */

const CONFIG = {
  // ── Google OAuth ──────────────────────────────────────────
  GOOGLE_CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',

  // ── Judge0 Code Execution API ─────────────────────────────
  // Sign up free at: https://rapidapi.com/judge0-official/api/judge0-ce
  JUDGE0_URL: 'https://judge0-ce.p.rapidapi.com',
  JUDGE0_KEY: 'YOUR_RAPIDAPI_KEY',

  // ── Language IDs for Judge0 ───────────────────────────────
  LANG_IDS: {
    python: 71,   // Python 3.8
    java:   62,   // Java (OpenJDK 13)
    cpp:    54,   // C++ (GCC 9.2.0)
  },

  // ── Admin credentials (in production: read from Excel via backend) ──
  ADMIN_CREDENTIALS: [
    { email: 'admin@test.com',        password: 'admin123',  name: 'Admin User',  role: 'superadmin' },
    { email: 'proctor@college.edu',   password: 'proctor1',  name: 'Proctor One', role: 'proctor'    },
  ],

  // ── Test settings defaults ────────────────────────────────
  TEST: {
    duration_minutes: 45,
    max_violations_before_terminate: 5,
    fullscreen_required: true,
    video_proctoring: true,
    ip_tracking: true,           // always on, cannot be disabled
    copy_paste_blocked: true,
    tab_switch_detection: true,
    mobile_blocked: true,
    google_auth_required: true,
  },

  // ── Scoring ───────────────────────────────────────────────
  SCORING: {
    full_pass:    100,   // % marks if all test cases pass
    partial_pass:  50,   // % marks if some test cases pass
    compile_error:  0,   // no marks for compile errors
    runtime_error:  0,
  },
};

/* ──────────────────────────────────────────────────────────
   QUESTION BANK
   In production these are loaded from the Excel sheet.
   langs: [] means all 3 allowed. One entry means locked.
   ────────────────────────────────────────────────────────── */
const QUESTIONS = [
  {
    id: 1,
    title: 'FizzBuzz Classic',
    description: `Write a program that reads a number N and prints numbers from 1 to N.
For multiples of 3 print "Fizz" (instead of the number).
For multiples of 5 print "Buzz".
For numbers that are multiples of both 3 and 5, print "FizzBuzz".
Print each value on a separate line.`,
    marks: 10,
    time_limit_seconds: 2,
    allowed_langs: ['python', 'java', 'cpp'],   // all allowed
    test_cases: [
      { input: '15', expected_output: '1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz', is_hidden: false },
      { input: '5',  expected_output: '1\n2\nFizz\n4\nBuzz', is_hidden: false },
      { input: '20', expected_output: '1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz\n16\n17\nFizz\n19\nBuzz', is_hidden: true },
    ],
    examples: [
      { input: '5', output: '1\n2\nFizz\n4\nBuzz' },
    ],
    hints: ['Use the modulo operator %', 'Check divisibility by 15 before 3 or 5'],
  },
  {
    id: 2,
    title: 'Fibonacci Sequence — Python Only',
    description: `Given a number N, print the first N Fibonacci numbers separated by spaces.
The Fibonacci sequence starts: 0, 1, 1, 2, 3, 5, 8, 13, 21 ...
Each number is the sum of the two preceding numbers.

Input: A single integer N (1 ≤ N ≤ 50)
Output: The first N Fibonacci numbers on one line, space-separated.`,
    marks: 10,
    time_limit_seconds: 2,
    allowed_langs: ['python'],    // LOCKED to Python only
    test_cases: [
      { input: '8',  expected_output: '0 1 1 2 3 5 8 13', is_hidden: false },
      { input: '1',  expected_output: '0',                is_hidden: false },
      { input: '12', expected_output: '0 1 1 2 3 5 8 13 21 34 55 89', is_hidden: true },
    ],
    examples: [
      { input: '8', output: '0 1 1 2 3 5 8 13' },
    ],
    hints: ['Use a loop to generate each term', 'Start with a=0, b=1 and swap'],
  },
  {
    id: 3,
    title: 'Prime Number Checker',
    description: `Read T test cases. For each test case, read a number N and determine if it is prime.
Print "Prime" if N is prime, else print "Not Prime".

A prime number is greater than 1 and has no divisors other than 1 and itself.

Input:
  First line: T (number of test cases)
  Next T lines: one integer N each

Output: T lines, each "Prime" or "Not Prime"`,
    marks: 10,
    time_limit_seconds: 3,
    allowed_langs: ['python', 'java', 'cpp'],   // all allowed
    test_cases: [
      { input: '5\n2\n3\n4\n17\n100', expected_output: 'Prime\nPrime\nNot Prime\nPrime\nNot Prime', is_hidden: false },
      { input: '3\n1\n0\n13',         expected_output: 'Not Prime\nNot Prime\nPrime',                is_hidden: true  },
    ],
    examples: [
      { input: '5\n2\n3\n4\n17\n100', output: 'Prime\nPrime\nNot Prime\nPrime\nNot Prime' },
    ],
    hints: ['Check divisors only up to √N', 'Numbers ≤ 1 are not prime'],
  },
];

/* ──────────────────────────────────────────────────────────
   STARTER CODE TEMPLATES
   ────────────────────────────────────────────────────────── */
const STARTER_CODE = {
  python: {
    default: `# Write your Python solution here
import sys
input = sys.stdin.readline

def solve():
    pass

solve()
`,
    fizzbuzz: `n = int(input())
for i in range(1, n + 1):
    if i % 15 == 0:
        print("FizzBuzz")
    elif i % 3 == 0:
        print("Fizz")
    elif i % 5 == 0:
        print("Buzz")
    else:
        print(i)
`,
    fibonacci: `n = int(input())
a, b = 0, 1
result = []
for _ in range(n):
    result.append(a)
    a, b = b, a + b
print(" ".join(map(str, result)))
`,
    prime: `def is_prime(n):
    if n <= 1:
        return False
    if n <= 3:
        return True
    if n % 2 == 0 or n % 3 == 0:
        return False
    i = 5
    while i * i <= n:
        if n % i == 0 or n % (i + 2) == 0:
            return False
        i += 6
    return True

t = int(input())
for _ in range(t):
    n = int(input())
    print("Prime" if is_prime(n) else "Not Prime")
`,
  },
  java: {
    default: `import java.util.*;
import java.io.*;

public class Solution {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        // Write your solution here

    }
}
`,
    fizzbuzz: `import java.util.Scanner;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        for (int i = 1; i <= n; i++) {
            if (i % 15 == 0)      System.out.println("FizzBuzz");
            else if (i % 3 == 0)  System.out.println("Fizz");
            else if (i % 5 == 0)  System.out.println("Buzz");
            else                   System.out.println(i);
        }
    }
}
`,
    prime: `import java.util.Scanner;

public class Solution {
    static boolean isPrime(int n) {
        if (n <= 1) return false;
        for (int i = 2; i * i <= n; i++)
            if (n % i == 0) return false;
        return true;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int t = sc.nextInt();
        while (t-- > 0) {
            int n = sc.nextInt();
            System.out.println(isPrime(n) ? "Prime" : "Not Prime");
        }
    }
}
`,
  },
  cpp: {
    default: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    // Write your solution here

    return 0;
}
`,
    fizzbuzz: `#include <iostream>
using namespace std;

int main() {
    int n;
    cin >> n;
    for (int i = 1; i <= n; i++) {
        if (i % 15 == 0)      cout << "FizzBuzz\\n";
        else if (i % 3 == 0)  cout << "Fizz\\n";
        else if (i % 5 == 0)  cout << "Buzz\\n";
        else                   cout << i << "\\n";
    }
    return 0;
}
`,
    prime: `#include <bits/stdc++.h>
using namespace std;

bool isPrime(int n) {
    if (n <= 1) return false;
    for (int i = 2; i * i <= n; i++)
        if (n % i == 0) return false;
    return true;
}

int main() {
    int t;
    cin >> t;
    while (t--) {
        int n; cin >> n;
        cout << (isPrime(n) ? "Prime" : "Not Prime") << "\\n";
    }
    return 0;
}
`,
  },
};

/* ──────────────────────────────────────────────────────────
   MOCK STUDENT DATA (for admin demo)
   In production: fetched from Firebase / your backend
   ────────────────────────────────────────────────────────── */
const MOCK_STUDENTS = [
  { name:'Arjun Sharma',   usn:'1RV21CS001', email:'arjun@rvce.edu.in',   phone:'9876543210', ip:'103.21.14.10',  status:'live',        score:null, violations:1, timeLeft:'38:22', lang:'Python', googleAccount:'arjun.s@gmail.com'  },
  { name:'Priya Nair',     usn:'1RV21CS002', email:'priya@rvce.edu.in',   phone:'9876543211', ip:'103.21.14.11',  status:'submitted',   score:24,   violations:0, timeLeft:'—',     lang:'Java',   googleAccount:'priya.n@gmail.com'   },
  { name:'Rahul Verma',    usn:'1RV21CS003', email:'rahul@rvce.edu.in',   phone:'9876543212', ip:'103.21.14.12',  status:'flagged',     score:null, violations:4, timeLeft:'29:11', lang:'C++',    googleAccount:'rahul.v@gmail.com'   },
  { name:'Sneha Rao',      usn:'1RV21CS004', email:'sneha@rvce.edu.in',   phone:'9876543213', ip:'103.21.14.13',  status:'submitted',   score:28,   violations:0, timeLeft:'—',     lang:'Python', googleAccount:'sneha.r@gmail.com'   },
  { name:'Kiran Patel',    usn:'1RV21CS005', email:'kiran@rvce.edu.in',   phone:'9876543214', ip:'103.21.14.14',  status:'not started', score:null, violations:0, timeLeft:'—',     lang:'—',      googleAccount:'kiran.p@gmail.com'   },
  { name:'Divya Menon',    usn:'1RV21CS006', email:'divya@rvce.edu.in',   phone:'9876543215', ip:'103.21.14.15',  status:'live',        score:null, violations:0, timeLeft:'41:18', lang:'Java',   googleAccount:'divya.m@gmail.com'   },
  { name:'Amit Kumar',     usn:'1RV21CS007', email:'amit@rvce.edu.in',    phone:'9876543216', ip:'103.21.14.16',  status:'submitted',   score:15,   violations:1, timeLeft:'—',     lang:'C++',    googleAccount:'amit.k@gmail.com'    },
  { name:'Lakshmi R',      usn:'1RV21CS008', email:'lakshmi@rvce.edu.in', phone:'9876543217', ip:'103.21.14.17',  status:'submitted',   score:22,   violations:0, timeLeft:'—',     lang:'Python', googleAccount:'lakshmi.r@gmail.com' },
  { name:'Suresh Babu',    usn:'1RV21CS009', email:'suresh@rvce.edu.in',  phone:'9876543218', ip:'103.21.14.18',  status:'live',        score:null, violations:2, timeLeft:'22:45', lang:'Python', googleAccount:'suresh.b@gmail.com'  },
  { name:'Kavitha Singh',  usn:'1RV21CS010', email:'kavitha@rvce.edu.in', phone:'9876543219', ip:'103.21.14.19',  status:'not started', score:null, violations:0, timeLeft:'—',     lang:'—',      googleAccount:'kavitha.s@gmail.com' },
];

const MOCK_RESULTS = [
  { name:'Priya Nair',   usn:'1RV21CS002', score:24, total:30, pct:80, rank:'A', timeTaken:'22:14', violations:0, lang:'Java',   submittedAt:'10:22:14 AM' },
  { name:'Sneha Rao',    usn:'1RV21CS004', score:28, total:30, pct:93, rank:'S', timeTaken:'18:40', violations:0, lang:'Python', submittedAt:'10:18:40 AM' },
  { name:'Amit Kumar',   usn:'1RV21CS007', score:15, total:30, pct:50, rank:'C', timeTaken:'43:11', violations:1, lang:'C++',    submittedAt:'10:43:11 AM' },
  { name:'Lakshmi R',    usn:'1RV21CS008', score:22, total:30, pct:73, rank:'B', timeTaken:'31:05', violations:0, lang:'Python', submittedAt:'10:31:05 AM' },
];
