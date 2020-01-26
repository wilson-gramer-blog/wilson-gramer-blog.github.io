---
title: "What does _: (nameless argument) mean in Swift?"
postDate: December 18, 2018
---

If you’ve dived deep enough in Swift functions you have probably come across one looking like this:

```swift
func myFunc(_: Type)
```

After looking at it for a moment, you may have wondered, “why does this argument have no name?” Indeed, this argument cannot be used inside the function nor specified by name when calling the function.

So why would something like this be useful? It essentially boils down to passing functions as parameters in other functions. Let’s say you have a function that looks like this:

```swift 
func run(every interval: TimeInterval, _ closure: (Date) -> Void) {
    // execute closure every `interval` seconds, and pass
    // the current date to it
}
```

Now let’s say I want to update my database with the current date every 5 seconds. Pretty simple:

```swift 
struct Database {

    // ...
    
    func insert(date: Date) {
        // ...
    }
}

let myDatabase = Database()
run(every: 5) { myDatabase.insert(date: $0) }

// shorter
run(every: 5, myDatabase.insert)
```

(Of course, this is a silly example, but you get the idea of where all this could be used.)

However, what if I have a different function that I’d intend to run at repeated intervals, that *doesn’t accept any parameters?* One way of doing this is the following:

```swift
run(every: ...) { _ in updateStuff() }
```

Alternatively, if you have access to the function and you only intend it to be called by the `run` function, a shorter way is by using a nameless argument:

```swift
func updateStuff(_: Date) { ... }
```

Now `updateStuff`‘s type is `(Date) -> Void`, so you can call `run` like this:

```swift
run(every: ..., updateStuff)
```

The only real-life use case I can find for nameless arguments is when using block-based timers —

```swift 
class ViewController: UIViewController {
    
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        
        // block: accepts a (Timer) -> Void closure
        Timer(timeInterval: 5, repeats: true, block: self.updateUI)
    }
    
    func updateUI(_: Timer) { ... }
}
```

So, nameless arguments. Not a super neat Swift feature or a game-changer in programming productivity, but it’s nice to know that they exist. Thanks for reading!

---

I stumbled across this as I’m rewriting [SuperHomework](http://superhomeworkapp.com/)‘s backend in Swift using [Vapor](http://vapor.codes/). I know I haven’t put SuperHomework out there very much lately, but stay tuned for a steady flow of awesome new features soon!
