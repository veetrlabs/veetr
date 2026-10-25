import Foundation

func check(_ condition: @autoclosure () throws -> Bool) rethrows { let result = try condition(); precondition(result) }

let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
defer { try? FileManager.default.removeItem(at: directory) }
let store = TripDiagnosticStore(directory:directory)
try store.configure(false,nil,0,"{}")
try store.append("trip",[["value":1.23456789]])
try check(try store.read("trip",0,Double.greatestFiniteMagnitude).isEmpty)
try store.configure(true,"trip",Date().timeIntervalSince1970*1000+60000,"{}")
try store.append("trip",[["value":1.23456789]])
let snapshot = try store.snapshot("trip")
let through = Double(snapshot["through"] as! Int64)
try store.append("trip",[["value":2]])
let rows = try store.read("trip",0,through)
check(rows.count == 2)
let value = try JSONSerialization.jsonObject(with:Data((rows[1]["body"] as! String).utf8)) as! [String:Double]
check(value["value"] == 1.23456789)
try store.configure(true,nil,0,"{}")
let stopped = try store.snapshot("trip")["through"] as! Int64
try store.append("trip",[["value":3]])
try check(try store.snapshot("trip")["through"] as! Int64 == stopped)
try store.configure(true,"expired",1,"{}")
try check(try store.active() == nil)
try store.append("expired",[["value":4]])
try check(try store.read("expired",0,Double.greatestFiniteMagnitude).count == 1)
try store.configure(false,nil,0,"{}")
try store.append("trip",[["value":5]])
try check(try store.read("trip",0,Double.greatestFiniteMagnitude).isEmpty)
try check(try store.read("expired",0,Double.greatestFiniteMagnitude).isEmpty)
print("Trip diagnostic storage checks passed")
