const messages = {
    '0': 'Some error occurred!',
    '1': 'The email address was not recognized. Please try again',
    '2': 'Invalid Password!',
    '3': 'Password recovery email successfully sent.',
    '4': 'You have registered Successfully, Please verify your Email by clicking on link sent on Email Provided Now you can access the portal',
    '5': 'Some Error Occured, Please Try Again',
    '6': 'Email already exist',
    '7': 'Verification email successfully sent, check your Email',
    '8': 'The email address was not recognized. Please try again or contact admin',
    '9': `This format is not allowed , please upload file with '.png','.gif','.jpg'`,
    '10': 'Profile Updated Successfully',
    '11': 'Certification Added Successfully.',
    '12': 'Certification Updated Successfully.',
    '13': 'Certificated Deleted Successfully',
    '14': 'You do not have any project yet.',
    '15': 'You Already have a Pending Time Sheet.',
    '16': 'Time Sheet Initiated Successfully',
    '17': `You don't have any project to submit time sheet!`,
    '18': 'Time Sheet Submitted Successfully.',
    '19': 'Report Deleted Successfully.',
    '20': 'The email address is Not Authorized to login. Please Contact Admin.',
    '21': 'Report Updated Successfully.',
    '22': 'You Are Not Authorized To Edit This Report!',
    '23': 'Your offer have been accepted.',
    '24': 'Your offer have been rejected.',
    '25': 'You choosed wrong option',
    '26': 'You are not authorized for this action.',
    '27': 'Preferred Destibation Successfully',
    '28': 'Site Name Already Exist , Please Try New One',
    '29': 'New Site Successfully Created',
    '30': "You Don't Have Any Site Assign !",
    '31': "Job Created Successfully",
    '32': "Sorry you don't have any site assigned to manage yet.",
    '33': "Updated Successfully.",
    '34': "Job update Successfully",
    '35': "Job time updated successfully",
    '36': "Report Submitted successfully",
    '37': "Notification Send Successfully",
    '38': "Your Password Changed Successfully.",
    '39': "New Password and Confirm New Password not matched!",
    '40': "Current Password and New Password can not be same!",
    '41': "Current Password is Invalid!",
    '42': "Location Updated",
    '43': "Selected users have been sent job notifications!!",
    '44': 'Subject Added Successfully .',
    '45': 'Subject Updated Successfully .',
    '46': 'Subject Deleted Successfully .',
    '47': 'Question Details Added Successfully .',
    '48': 'No Records Found .',
    '49': 'Question Deleted Successfully .',
    '50': 'Question Details Updated Successfully .',
    '51': 'Exam Rules Updated Successfully .',
    '52': 'New planner Created Successfully.',
    '53': 'New Supervisor Created Successfully.',
    '54': 'Role already exist.',
    '55': 'Role Added Successfully .',
    '56': 'Role Updated Successfully .',
    '57': 'Role Deleted Successfully .',
    '58': 'Skills Added Successfully .',
    '59': 'Skills Updated Successfully .',
    '60': 'Skills Deleted Successfully .',
    '61': 'Selected users have been sent job notifications!!',
    '62': 'Designation Change Successfully.',
    '63': 'Status Changed! You will not be shown in any job searches.',
    '64': 'Status Changed! You will be shown in job searches.',
    '65': 'This Site name has already Exist.',
    '66': 'New Site Added Sucessfully.',
    '67': 'Supervisor Updated Successfully.',
    '68': 'Job Updated Successfully.',
    '69': 'Job Code Already Exist.',
    '70': 'Users Not Found.',
    '71': 'Selected users have been sent job notifications!!',
    '72': 'Location Successfully Updated',
    '73': 'You do not have any reports yet',
    '74': 'Selected users have been sent job notifications',
    '75': 'Rates Updated Successfully',
    '76': 'You Are Not Authorized To Finish The Job Yet !',
    '77': 'Company Added Successfully.',
    '78': "This format is not allowed , please upload file with '.png','.gif','.jpg','.pdf'",
    '79': 'Company Details Updated Successfully.',
    '80': 'Company Deleted Successfully.',
    '81': 'Comapny Logo is required.',
    '82': 'Job Mark As Finised Successfully.',
    '83': 'Please Select All Users Ratings.',
    '84': 'Location Added Successfully.',
    '85': 'Designation Updated Successfully',
    '86': 'Time Updated Successfully',
    '87': 'Selected users have been sent job notifications !!',
    '88': 'Please Enter Valid Time.',
    '89': 'Password Successfully Changed.',
    '90': `Status Changed !!! You Won't Be shown in Any Job Searches`,
    '91': 'Status Changed !!! You Will Be shown in Job Searches',
    '92': 'You arw not eligible for exam',
    '93': 'You have submit successfully',
    '94': 'You Need To Clock-In First.',
    '95': 'Technicnian Profile Updated Successfully',
    '96': 'You Already have An Time Sheet For This Time Slot.',
    '97': `You don't have any site assign to submit time sheet!`,
    '98': 'Something went wrong.',
    '99': 'Time Sheet Deleted Successfully',
    '100': 'Time Sheet Updated Successfully',
    '101': 'Time Stauts Updated Successfully',
    '102': 'project attachment uploaded successfully',
    '103': 'Uploaded attachment Deleted Successfully',
    '104': 'You are not authorised to upload images',
    '105': 'You do not have any location yet.',
    '106': 'There are no projects on this site yet.',
    '107': 'There are no reviews for this user yet.', 
    '108': 'Error occured to calculating distance please try again.',
    '109': 'There is no supervisor assigned for the selected trade,Proceed with the different trade or assign a suppervisor.',
    '110': `You can't accept this job as you already have a job in this time frame.`,
    '111': 'There are no projects yet.',
    '112': `you don't have any projects yet.`,
    '113': `you don't have any project on this sites.`,
    '114': `No id uploaded yet.`,
    '115': `Record Added Successfully.`,
};

module.exports = function createResponse(successResponse, messageCode) {
    return {
        request: successResponse,
        message: messages[messageCode]
    };
};